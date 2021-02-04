const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const axios = require('axios');
const dotenv = require('dotenv').config();
const logger = require('./logger');
const fs = require('fs');
const { clearInterval } = require('timers');

const app = express();
app.use(cors());
app.use(bodyParser.json());

let access_token;
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
		fs.readFile('./settings.json', 'utf8', (err, data) => {
			if (err) {
				logger.error('Settings file not found. Closing app');
				clearInterval(appInterval);
				return;
			}

			const settings = JSON.parse(data);
			const postCount = settings.settings.postCount || '50';
			axios
				.get(
					`https://graph.facebook.com/v9.0/me/groups?fields=feed.limit(${postCount})%7Bstatus_type%2Cdescription%2Cfrom%2Cid%2Cmessage%2Cname%2Cstory%2Ctype%2Cpermalink_url%2Ccreated_time%2Cattachments%7Bmedia%2Cmedia_type%2Csubattachments%7D%2Ctarget%2Clink%2Csource%2Cupdated_time%2Cobject_id%2Cprivacy%7D%2Cname&limit=1000&access_token=${access_token}`
				)
				.then(response => resolve(response.data))
				.catch(error => reject(error));
		});
	});
}

async function handlePostsUpload(data) {
	const mappedGroupPosts = mapPostsToSheetRows(data);

	fs.readFile('./settings.json', 'utf8', (err, data) => {
		if (err) {
			logger.error('Setting file not found. Posts not uploaded. Stopping App');
			clearInterval(appInterval);
			return;
		}
		const settings = JSON.parse(data);
		if (!settings.sheets || !settings.sheets.length) {
			logger.error('Sheets not found. Posts not uploaded. Stopping App');
			clearInterval(appInterval);
		} else {
			const sheets = settings.sheets;
			sheets.forEach(sheet => {
				const postsToUpload = [];
				fecthPostsID(sheet.googleSheetID)
					.then(response => {
						const sheetPostsID = response;
						const groupPostsToUpload = mappedGroupPosts.slice(
							parseInt(sheet.from) - 1,
							parseInt(sheet.to)
						);
						groupPostsToUpload.forEach(groupPosts => {
							groupPosts.forEach(post => postsToUpload.push(post));
						});

						const filteredPosts = filterDuplicatePosts(
							postsToUpload,
							sheetPostsID
						);

						if (filteredPosts.length) {
							uploadPosts(filteredPosts, sheet.googleSheetID)
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
}

function mapPostsToSheetRows(data) {
	const posts = [];

	data.forEach(groupData => {
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
					// console.log(attachmentsData, mediaType);

					if (mediaType === 'album') {
						const subAttachmentsData = attachmentsData.subattachments.data;
						// console.log(subAttachmentsData);
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

		posts.push(mappedPosts);
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
	fs.readFile('./settings.json', 'utf8', async (err, data) => {
		if (err) {
			logger.error('Setting file not found. App not started');
			return;
		}
		const settings = JSON.parse(data);
		if (!settings.auth_token) {
			logger.error('Auth token not found. App not started');
		} else {
			access_token = settings.auth_token;
			const interval = parseInt(settings.settings.interval);
			appInterval = setInterval(appHandler, interval * 60 * 1000);
		}
	});
}

// EAAF7BKV1MgQBAASyjM9LQjbLAJymAEktZCkHuChsenTfpjIG8CIQyA0cryszZBS7oYMfZBRelMA3KNNEUZBSADLxVXXZCGkZB1WPw5ZA1uGLYtxIbI2qHRCPOnAsFODcUHzhZAH3ncVSUEBiPrpbEniejT9E4IK8IaLdB1aKTJL2SoruQlNv5v0Facz8hboZBhw0ZD

app.get('/appStatus', (req, res) => {
	fs.readFile('./settings.json', 'utf8', async (err, data) => {
		if (err) {
			res.send({
				status: 'not active',
				message: 'User token not found',
				type: 'error'
			});
			return;
		}
		const settings = JSON.parse(data);
		if (!settings.auth_token) {
			res.send({
				status: 'not active',
				message: 'User token not found. Please update token.',
				type: 'error'
			});
		} else {
			const access_token = settings.auth_token;
			axios
				.get(
					`https://graph.facebook.com/v9.0/me?fields=id%2Cname&&access_token=${access_token}`
				)
				.then(response => {
					res.send({
						status: 'active',
						message: 'App is running.',
						type: 'ok',
						name: response.data.name,
						postCount: settings.settings.postCount,
						interval: settings.settings.interval,
						sheets: settings.sheets
					});
				})
				.catch(error => {
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
		fs.readFile('./settings.json', 'utf8', (err, data) => {
			if (err) {
				res.send({ message: 'not updated' });
				return;
			}

			const settings = JSON.parse(data);
			const token = req.body.token;
			axios
				.get(
					`https://graph.facebook.com/v9.0/me?fields=id%2Cname&&access_token=${token}`
				)
				.then(response => {
					access_token = token;

					const newSettings = {
						auth_token: token,
						settings: {
							postCount: settings.settings.postCount,
							interval: settings.settings.interval
						},
						sheets: settings.sheets
					};

					fs.writeFile(
						'settings.json',
						JSON.stringify(newSettings),
						function (err) {
							if (err) {
								res.send({ message: 'not updated' });
								return;
							}
							logMessage('Auth Token Updated');
							clearTimeout(snooze);
							clearInterval(appInterval);
							appInitializer();
							res.send({
								message: 'updated',
								name: response.data.name,
								postCount: newSettings.settings.postCount,
								interval: newSettings.settings.interval,
								sheets: newSettings.sheets
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
	if (!req.body.interval || !req.body.postCount || !req.body.sheets) {
		res.send({ message: 'not updated' });
	} else {
		fs.readFile('./settings.json', 'utf8', async (err, data) => {
			if (err) {
				console.log(err);
				res.send({ message: 'not updated' });
				return;
			}
			const settings = JSON.parse(data);
			const newSettings = {
				auth_token: settings.auth_token,
				settings: {
					postCount: req.body.postCount,
					interval: req.body.interval
				},
				sheets: req.body.sheets
			};

			fs.writeFile(
				'./settings.json',
				JSON.stringify(newSettings),
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
	fs.readFile('./settings.json', 'utf8', async (err, data) => {
		if (err) {
			console.log(err);
			res.send({ message: 'not updated' });
			return;
		}
		const settings = JSON.parse(data);
		const newSettings = {
			auth_token: '',
			settings: {
				postCount: settings.settings.postCount,
				interval: settings.settings.interval
			},
			sheets: settings.sheets
		};

		fs.writeFile(
			'./settings.json',
			JSON.stringify(newSettings),
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

app.listen(5078, () => {
	console.log('App listening on port 5078!');
	try {
		appInitializer();
	} catch (error) {
		console.log(error);
	}
});
