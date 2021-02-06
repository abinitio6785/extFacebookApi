const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const axios = require('axios');
const dotenv = require('dotenv').config();
const logger = require('./logger');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(bodyParser.json());

let appInterval;
let snooze;

const auth = new google.auth.GoogleAuth({
	keyFile: './cred.json',
	scopes: [
		'https://www.googleapis.com/auth/spreadsheets',
		'https://www.googleapis.com/auth/drive',
		'https://www.googleapis.com/auth/drive.readonly',
		'https://www.googleapis.com/auth/drive.file',
		'https://www.googleapis.com/auth/spreadsheets.readonly'
	]
});
const sheets = google.sheets({ version: 'v4', auth });

function fetchPosts() {
	return new Promise(async (resolve, reject) => {
		fs.readFile('./users.json', 'utf8', (err, data) => {
			if (err) {
				logger.error('Users file not found. Closing app');
				clearInterval(appInterval);
				return;
			}

			const users = JSON.parse(data);
			const activeUser = users.filter(user => user.active)[0];
			const postCount = activeUser.settings.postCount || '50';
			const accessToken = activeUser.accessToken;
			axios
				.get(
					`https://graph.facebook.com/v9.0/me/groups?fields=feed.limit(${postCount})%7Bstatus_type%2Cdescription%2Cfrom%2Cid%2Cmessage%2Cname%2Cstory%2Ctype%2Cpermalink_url%2Ccreated_time%2Cattachments%7Bmedia%2Cmedia_type%2Csubattachments%7D%2Ctarget%2Clink%2Csource%2Cupdated_time%2Cobject_id%2Cprivacy%7D%2Cname&limit=1000&access_token=${accessToken}`
				)
				.then(response => resolve(response.data))
				.catch(error => reject(error));
		});
	});
}

function handlePostsUpload(data) {
	const mappedGroupPosts = mapPostsToSheetRows(data);

	if (Object.keys(mappedGroupPosts).length) {
		fs.readFile('./users.json', 'utf8', (err, data) => {
			if (err) {
				logger.error('Users file not found. Posts not uploaded. Stopping App');
				clearInterval(appInterval);
				return;
			}
			const users = JSON.parse(data);
			const activeUser = users.filter(user => user.active)[0];
			if (!activeUser.groupsToSheets || !activeUser.groupsToSheets.length) {
				logger.error(
					'Groups to sheets data not found. Posts not uploaded. Stopping App'
				);
				clearInterval(appInterval);
			} else {
				const groupsToSheets = activeUser.groupsToSheets;
				const sheets = {};

				groupsToSheets.forEach(sheet => {
					if (sheet.googleSheetUrl !== '') {
						if (sheets.hasOwnProperty(sheet.googleSheetUrl)) {
							sheets[sheet.googleSheetUrl] = [
								...sheets[sheet.googleSheetUrl],
								sheet.id
							];
						} else {
							sheets[sheet.googleSheetUrl] = [sheet.id];
						}
					}
				});

				const sheetsKeys = Object.keys(sheets);

				sheetsKeys.forEach(sheetKey => {
					let postsToUpload = [];
					const mappedGroupPostsKeys = Object.keys(mappedGroupPosts);

					mappedGroupPostsKeys.forEach(groupPostsKey => {
						if (sheets[sheetKey].includes(groupPostsKey))
							postsToUpload = [
								...postsToUpload,
								...mappedGroupPosts[groupPostsKey]
							];
					});
					fecthPostsID(getSheetIdFromUrl(sheetKey))
						.then(response => {
							const sheetPostsID = response;

							const filteredPosts = filterDuplicatePosts(
								postsToUpload,
								sheetPostsID
							);
							if (filteredPosts.length) {
								uploadPosts(filteredPosts, getSheetIdFromUrl(sheetKey))
									.then(response => {
										result = response;
										const sheetUpdates = result.data.updates;
										const message = `${sheetUpdates.updatedRows} rows, ${sheetUpdates.updatedColumns} columns and ${sheetUpdates.updatedCells} cells updated`;
										logMessage(message);
									})
									.catch(error => {
										console.log(error);
										const message = error?.response?.data?.error?.message;
										logger.error(
											message + ". Couldn't upload posts to google sheet"
										);
									});
							} else {
								logMessage('no new posts to upload');
							}
						})
						.catch(error => {
							const message = error?.response?.data?.error?.message;
							logger.error(
								message + ". Couldn't fetch post ids from google sheet"
							);
						});
				});
			}
		});
	} else {
		logger.info('No feed data to upload');
	}
}

function getSheetIdFromUrl(url) {
	let id = '';
	if (url.includes('/d/')) {
		id = url.split('/d/')[1].split('/')[0];
	}
	return id;
}

function mapPostsToSheetRows(data) {
	const posts = {};
	data.forEach(groupData => {
		if (groupData.feed) {
			const postsData = groupData.feed.data;
			const mappedPosts = [];
			if (postsData.length) {
				postsData.forEach(postData => {
					const sheetRows = {
						postID: '',
						groupName: '',
						objectID: '',
						type: '',
						from: '',
						message: '',
						story: '',
						permaLinkUrl: '',
						link: '',
						media: '',
						target: '',
						source: '',
						privacy: '',
						createdAt: '',
						updatedAt: ''
					};
					sheetRows.postID = postData.id;
					sheetRows.groupName = groupData.name;
					sheetRows.type = postData.type;
					sheetRows.createdAt = postData.created_time;
					sheetRows.updatedAt = postData.updated_time;
					sheetRows.permaLinkUrl = postData.permalink_url;

					if (postData.object_id) sheetRows.objectID = postData.object_id;
					if (postData.from) sheetRows.from = postData.from.name;
					if (postData.message) sheetRows.message = postData.message;
					if (postData.story) sheetRows.story = postData.story;
					if (postData.link) sheetRows.link = postData.link;
					if (postData.target) sheetRows.target = postData.target.name;
					if (postData.source) sheetRows.source = postData.source;
					if (postData.privacy && postData.privacy.value)
						sheetRows.privacy = postData.privacy.value;

					if (postData.attachments) {
						const attachmentsData = postData.attachments.data[0];
						const mediaType = attachmentsData.media_type;
						sheetRows.type = mediaType;

						if (mediaType === 'album') {
							const subAttachmentsData = attachmentsData.subattachments.data;
							subAttachmentsData.forEach(subAttachment => {
								const mediaData = subAttachment.media;
								if (subAttachment.type === 'video') {
									if (sheetRows.media.length)
										sheetRows.media = `${sheetRows.media} , ${mediaData.source}`;
									else sheetRows.media = mediaData.source;
								} else if (subAttachment.type === 'photo') {
									if (sheetRows.media.length)
										sheetRows.media = `${sheetRows.media} , ${mediaData.image.src}`;
									else sheetRows.media = mediaData.image.src;
								}
							});
						} else if (mediaType === 'photo') {
							const mediaData = attachmentsData.media;
							sheetRows.media = mediaData.image.src;
						} else if (mediaType === 'video') {
							const mediaData = attachmentsData.media;
							sheetRows.media = mediaData.source;
						}
					}
					mappedPosts.push(sheetRows);
				});
			}

			posts[groupData.id] = mappedPosts;
		}
	});
	return posts;
}

function fecthPostsID(spreadsheetId) {
	return new Promise((resolve, reject) => {
		sheets.spreadsheets.values.get(
			{
				spreadsheetId: spreadsheetId,
				range: 'sheet1!A1:A',
				majorDimension: 'COLUMNS'
			},
			(err, res) => {
				if (err) {
					reject(err);
				} else {
					const rows = res.data.values[0];
					resolve(rows);
				}
			}
		);
	});
}

function filterDuplicatePosts(mappedPosts, sheetPostsID) {
	const filteredPosts = mappedPosts.filter(
		post => !sheetPostsID.includes(post.postID)
	);
	return filteredPosts;
}

function uploadPosts(posts, spreadsheetId) {
	return new Promise((resolve, reject) => {
		const values = posts.map(post => Object.values(post));
		const resource = {
			values
		};
		sheets.spreadsheets.values.append(
			{
				spreadsheetId: spreadsheetId,
				range: 'sheet1',
				valueInputOption: 'RAW',
				resource
			},
			(err, result) => {
				if (err) {
					reject(err);
				} else {
					resolve(result);
				}
			}
		);
	});
}

function logMessage(message) {
	logger.info(message);
}

async function appHandler() {
	try {
		const data = await fetchPosts();
		if (data.data && data.data.length) {
			handlePostsUpload(data.data);
		} else {
			logMessage('No group or feed data available.');
		}
	} catch (error) {
		console.log(error);
		if (
			error?.response?.data?.error?.message ===
			'(#4) Application request limit reached'
		) {
			clearInterval(appInterval);
			clearTimeout(snooze);
			snooze = setTimeout(() => {
				appInitializer();
			}, 30 * 60 * 1000);
			const message = error?.response?.data?.error?.message;
			console.log(message);
			logger.error(message + '. Snoozing App for 30 minutes');
		} else {
			clearInterval(appInterval);
			const message = error?.response?.data?.error?.message;
			logger.error(message + '. Stopping Posts Fetching');
		}
	}
}

function appInitializer() {
	fs.readFile('./users.json', 'utf8', async (err, data) => {
		if (err) {
			logger.error('Users file not found. App not started');
			return;
		}
		const users = JSON.parse(data);
		const activeUser = users.filter(user => user.active);
		if (!activeUser.length) {
			logger.error('No active user found. App not started');
		} else if (!activeUser[0].accessToken) {
			logger.error('Access Token not found. App not started');
		} else if (!activeUser[0].groupsToSheets.length) {
			logger.error('Groups to sheets not available. App not started');
		} else {
			const interval = parseInt(activeUser[0].settings.interval);
			appInterval = setInterval(appHandler, interval * 60 * 1000);
			appHandler();
		}
	});
}

app.get('/appStatus', (req, res) => {
	fs.readFile('./users.json', 'utf8', (err, data) => {
		if (err) {
			res.send({
				status: 'not active',
				message: 'Facebook authentication token not found.',
				type: 'error'
			});
			return;
		}
		const users = JSON.parse(data);
		const activeUser = users.filter(user => user.active);
		if (!activeUser.length) {
			res.send({
				status: 'not active',
				message: 'Facebook authentication token not found.',
				type: 'error'
			});
		} else {
			const accessToken = activeUser[0].accessToken;
			axios
				.get(
					`https://graph.facebook.com/v9.0/me?fields=id%2Cname&&access_token=${accessToken}`
				)
				.then(response => {
					getUserGroups(accessToken)
						.then(userFacebookGroups => {
							res.send({
								status: 'active',
								message: 'App is running.',
								type: 'ok',
								name: response.data.name,
								postCount: activeUser[0].settings.postCount,
								interval: activeUser[0].settings.interval,
								groupsToSheets: activeUser[0].groupsToSheets,
								userFacebookGroups
							});
						})
						.catch(error => {
							console.log(error);
							if (
								error?.response?.data?.error?.message ===
								'(#4) Application request limit reached'
							) {
								res.send({
									status: 'active',
									message:
										'Application limit reached. App snoozed for 30 minutes.',
									type: 'warning'
								});
							} else {
								res.send({
									status: 'not active',
									message: 'User Token Expired. Please update token',
									type: 'error'
								});
							}
						});
				})
				.catch(error => {
					console.log(error);
					if (
						error?.response?.data?.error?.message ===
						'(#4) Application request limit reached'
					) {
						res.send({
							status: 'active',
							message: 'Application limit reached. App snoozed for 30 minutes.',
							type: 'warning'
						});
					} else {
						res.send({
							status: 'not active',
							message: 'User Token Expired. Please update token',
							type: 'error'
						});
					}
				});
		}
	});
});

app.post('/updateToken', (req, res) => {
	if (!req.body.token) {
		res.send({ message: 'not updated' });
	} else {
		fs.readFile('./users.json', 'utf8', (err, data) => {
			if (err) {
				res.send({ message: 'not updated' });
				return;
			}

			const users = JSON.parse(data);
			const token = req.body.token;
			axios
				.get(
					`https://graph.facebook.com/v9.0/me?fields=id%2Cname&&access_token=${token}`
				)
				.then(response => {
					const userData = users.filter(user => user.id === response.data.id);
					const otherUsersData = users.filter(
						user => user.id !== response.data.id
					);

					let updatedUserData;
					if (userData.length) {
						updatedUserData = {
							active: true,
							accessToken: token,
							id: response.data.id,
							settings: userData[0].settings,
							groupsToSheets: userData[0].groupsToSheets
						};
					} else {
						updatedUserData = {
							active: true,
							accessToken: token,
							id: response.data.id,
							settings: { postCount: '50', interval: '5' },
							groupsToSheets: []
						};
					}

					fs.writeFile(
						'users.json',
						JSON.stringify([updatedUserData, ...otherUsersData]),
						function (err) {
							if (err) {
								res.send({ message: 'not updated' });
								return;
							}

							logMessage('Auth Token Updated');
							getUserGroups(token)
								.then(userFacebookGroups => {
									clearTimeout(snooze);
									clearInterval(appInterval);
									appInitializer();
									res.send({
										message: 'updated',
										status: 'App is running.',
										type: 'ok',
										name: response.data.name,
										postCount: updatedUserData.settings.postCount,
										interval: updatedUserData.settings.interval,
										groupsToSheets: updatedUserData.groupsToSheets,
										userFacebookGroups
									});
								})
								.catch(error => {
									console.log(error);
									if (
										error?.response?.data?.error?.message ===
										'(#4) Application request limit reached'
									) {
										res.send({
											message: 'updated',
											status: 'Application request limit reached.',
											type: 'warn'
										});
									}
								});
						}
					);
				})
				.catch(error => {
					console.log(error);
					logger.error(
						'Token not updated ' +
							error?.response?.data?.error?.message +
							'. Stopping App '
					);
					clearInterval(appInterval);
					res.send({ status: 'not updated' });
				});
		});
	}
});

app.post('/updateSettings', (req, res) => {
	if (!req.body.interval || !req.body.postCount || !req.body.groupsToSheets) {
		res.send({ message: 'not updated' });
	} else {
		fs.readFile('./users.json', 'utf8', async (err, data) => {
			if (err) {
				console.log(err);
				res.send({ message: 'not updated' });
				return;
			}
			const users = JSON.parse(data);
			const userData = users.filter(user => user.active);
			const otherUsersData = users.filter(user => !user.active);

			const updatedUserData = {
				active: true,
				accessToken: userData[0].accessToken,
				id: userData[0].id,
				settings: {
					postCount: req.body.postCount,
					interval: req.body.interval
				},
				groupsToSheets: req.body.groupsToSheets
			};

			fs.writeFile(
				'./users.json',
				JSON.stringify([updatedUserData, ...otherUsersData]),
				function (err) {
					if (err) {
						res.send({ message: 'not updated' });
						return;
					}
					logMessage('App settings updated');
					clearInterval(appInterval);
					clearTimeout(snooze);
					appInitializer();
					res.send({ message: 'updated' });
				}
			);
		});
	}
});

app.post('/logout', (req, res) => {
	fs.readFile('./users.json', 'utf8', async (err, data) => {
		if (err) {
			console.log(err);
			res.send({ message: 'not updated' });
			return;
		}
		const users = JSON.parse(data);
		const activeUser = users.filter(user => user.active);
		const otherUsers = users.filter(user => !user.active);

		activeUser[0].active = false;
		fs.writeFile(
			'./users.json',
			JSON.stringify([...activeUser, ...otherUsers]),
			function (err) {
				if (err) {
					res.send({ message: 'not updated' });
					return;
				}
				logMessage('User Logged Out');
				clearInterval(appInterval);
				clearTimeout(snooze);
				res.send({ message: 'logged out' });
			}
		);
	});
});

function getUserGroups(accessToken) {
	return new Promise(async (resolve, reject) => {
		try {
			const appToken = '416734862717444|5uos3JiG_XFbeaB8IRpKLg_j7qQ';
			let appInstalledGroups = [];
			const appInstalledUrl = `https://graph.facebook.com/v9.0/416734862717444/app_installed_groups?access_token=${appToken}`;
			let response = await axios.get(appInstalledUrl);
			appInstalledGroups = [...appInstalledGroups, ...response.data.data];
			while (
				response.data &&
				response.data.paging &&
				response.data.paging.next
			) {
				response = await axios.get(response.data.paging.next);
				appInstalledGroups = [...appInstalledGroups, ...response.data.data];
			}

			appInstalledGroups = appInstalledGroups.map(groupData => groupData.id);
			const userGroupsUrl = `https://graph.facebook.com/v9.0/me/groups?fields=id%2Cname%2Cadministrator&access_token=${accessToken}`;
			let groups = [];
			let groupsResponse = await axios.get(userGroupsUrl);
			groups = [...groups, ...groupsResponse.data.data];
			while (
				groupsResponse.data &&
				groupsResponse.data.paging &&
				groupsResponse.data.paging.next
			) {
				groupsResponse = await axios.get(groupsResponse.data.paging.next);
				groups = [...groups, ...groupsResponse.data.data];
			}

			const userPostsAvailableGroup = groups.filter(group =>
				appInstalledGroups.includes(group.id)
			);
			resolve(userPostsAvailableGroup);
		} catch (error) {
			reject(error);
		}
	});
}

app.listen(5078, () => {
	console.log('App listening on port 5078!');
	try {
		appInitializer();
	} catch (error) {
		console.log(error);
	}
});
