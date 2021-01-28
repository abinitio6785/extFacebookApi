const { google } = require('googleapis');
const axios = require('axios');
const dotenv = require('dotenv').config();
const logger = require('./logger');

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
		try {
			const access_token = process.env.fb_access_token;
			const response = await axios.get(
				`https://graph.facebook.com/v9.0/me/groups?fields=feed.limit(50)%7Bstatus_type%2Cdescription%2Cfrom%2Cid%2Cmessage%2Cname%2Cstory%2Ctype%2Cpermalink_url%2Ccreated_time%2Cattachments%7Bmedia%2Cmedia_type%2Csubattachments%7D%2Ctarget%2Clink%2Csource%2Cupdated_time%2Cobject_id%2Cprivacy%7D%2Cname&limit=50&access_token=${access_token}`
			);

			resolve(response.data);
		} catch (error) {
			reject(error);
		}
	});
}

async function handlePostsUpload(data) {
	try {
		const mappedPosts = mapPostsToSheetRows(data);
		const sheetPostsID = await fecthPostsID();
		const filteredPosts = filterDuplicatePosts(mappedPosts, sheetPostsID);

		if (filteredPosts.length) {
			const result = await uploadPosts(filteredPosts);
			const sheetUpdates = result.data.updates;
			const message = `${sheetUpdates.updatedRows} rows, ${sheetUpdates.updatedColumns} columns and ${sheetUpdates.updatedCells} cells updated`;
			logMessage(message);
		} else {
			logMessage('no new posts to upload');
		}
	} catch (error) {
		console.log(error);
	}
}

function mapPostsToSheetRows(data) {
	const posts = [];

	data.forEach(groupData => {
		const postsData = groupData.feed.data;
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
				sheetRows.updatedAt = postData.update_time;
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
				posts.push(sheetRows);
			});
		}
	});

	return posts;
}

function fecthPostsID() {
	return new Promise((resolve, reject) => {
		sheets.spreadsheets.values.get(
			{
				spreadsheetId: '1tktdZKgC3RgPJHJ0eEKRSxaGt9CskvbA0jEE5ynyLHQ',
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

function uploadPosts(posts) {
	return new Promise((resolve, reject) => {
		const values = posts.map(post => Object.values(post));
		const resource = {
			values
		};
		sheets.spreadsheets.values.append(
			{
				spreadsheetId: '1tktdZKgC3RgPJHJ0eEKRSxaGt9CskvbA0jEE5ynyLHQ',
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
		clearInterval(interval);
		const message = error.response.data.error.message;
		console.log(message);
		logger.error(message + '. Stopping Posts Fetching');
	}
}

const interval = setInterval(appHandler, 60 * 1000);
