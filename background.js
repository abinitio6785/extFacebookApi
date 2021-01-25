chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.todo === 'check_auth_status') {
		getToken().then(token => {
			if (!token) {
				sendResponse({ data: { error: 'not authenticated' } });
			} else {
				getFbUserData(token).then(data => {
					if (data.error) {
						sendResponse({ data: { error: 'not authenticated' } });
					} else {
						sendResponse(data);
					}
				});
			}
		});
	}

	if (request.todo === 'logout') {
		removeFacebookToken();
		chrome.identity.clearAllCachedAuthTokens(() => console.log('cleared'));
	}

	if (request.todo === 'authorize_facebook') {
		handleFbAuthentication().then(token => {
			getFbUserData(token).then(data => {
				sendResponse(data);
			});
		});
	}

	if (request.todo === 'fetch_posts') {
		// console.log(request.values);
		const options = {
			post_count: 10,
			interval: 300
		};

		handlePostsFetchAndUpload(options);
	}
	return true;
});

async function handlePostsFetchAndUpload(options) {
	const access_token = await getToken();
	const groupPosts = await getGroupPosts(access_token);
	console.log(groupPosts);

	saveGroupPosts(groupPosts);
}

function getGroupPosts(access_token) {
	return new Promise((resolve, reject) => {
		let init = {
			method: 'GET',
			async: true,
			headers: {
				'Content-Type': 'application/json'
			},
			contentType: 'json'
		};
		fetch(
			`https://graph.facebook.com/v9.0/me/groups?fields=administrator%2Cfeed.limit(10)&limit=50&access_token=${access_token}`,
			init
		)
			.then(response => response.json())
			.then(data => {
				resolve(data);
			});
	});
}

function saveGroupPosts(groupPosts) {
	const data = groupPosts.data;
	let posts = [];

	data.forEach(data => {
		const feedData = data.feed.data;
		feedData.forEach(post => posts.push(post));
	});

	chrome.identity.getAuthToken({ interactive: true }, async token => {
		let init = {
			method: 'GET',
			async: true,
			headers: {
				Authorization: 'Bearer ' + token,
				'Content-Type': 'application/json'
			},
			contentType: 'json'
		};
		const response = await fetch(
			'https://sheets.googleapis.com/v4/spreadsheets/1tktdZKgC3RgPJHJ0eEKRSxaGt9CskvbA0jEE5ynyLHQ/values/sheet1!A1%3AA?majorDimension=COLUMNS&valueRenderOption=FORMATTED_VALUE&key=AIzaSyAzM0wR7oql6w40Cv2lnizenVsFl9BL0mg',
			init
		);

		const data = await response.json();
		const postIds = data.values[0];

		posts = posts.filter(post => !postIds.includes(post.id));

		posts = posts.map(post => [post.id, post.story, post.updated_time]);

		console.log(posts);
		if (posts.length) {
			let post_init = {
				method: 'POST',
				async: true,
				headers: {
					Authorization: 'Bearer ' + token,
					'Content-Type': 'application/json'
				},
				contentType: 'json',
				body: JSON.stringify({
					values: [...posts]
				})
			};
			fetch(
				'https://sheets.googleapis.com/v4/spreadsheets/1tktdZKgC3RgPJHJ0eEKRSxaGt9CskvbA0jEE5ynyLHQ/values/sheet1:append?valueInputOption=RAW&key=AIzaSyAzM0wR7oql6w40Cv2lnizenVsFl9BL0mg',
				post_init
			)
				.then(response => response.json())
				.then(data => console.log(data));
		}
	});
}

function handleFbAuthentication() {
	return new Promise((resolve, reject) => {
		const options = {
			url: `https://www.facebook.com/v9.0/dialog/oauth?client_id=416734862717444&redirect_uri=https://plfolocjbcbhgjgfkmkkjholfdahmmaa.chromiumapp.org/&response_type=token&scope=public_profile,email,publish_to_groups,groups_access_member_info`,
			interactive: true
		};

		chrome.identity.launchWebAuthFlow(options, url => {
			const access_token = url.split('#')[1].split('&')[0].split('=')[1];
			saveToken(access_token);
			resolve(access_token);
		});
	});
}

function saveToken(access_token) {
	chrome.storage.sync.set({ fb_token: access_token });
}

function getToken() {
	return new Promise((resolve, reject) => {
		try {
			chrome.storage.sync.get('fb_token', token => {
				resolve(token.fb_token);
			});
		} catch (error) {
			console.log(error);
		}
	});
}

function removeFacebookToken() {
	chrome.storage.sync.remove('fb_token', () => {
		console.log('token deleted');
	});
}

function getFbUserData(access_token) {
	return new Promise((resolve, reject) => {
		let init = {
			method: 'GET',
			async: true,
			headers: {
				'Content-Type': 'application/json'
			},
			contentType: 'json'
		};
		fetch(
			`https://graph.facebook.com/me?fields=id,name&access_token=${access_token}`,
			init
		)
			.then(response => response.json())
			.then(data => {
				resolve(data);
			});
	});
}

// chrome.identity.getAuthToken({ interactive: true }, getSheetData);

function getSheetData(token) {
	// let init = {
	// 	method: 'GET',
	// 	async: true,
	// 	headers: {
	// 		Authorization: 'Bearer ' + token,
	// 		'Content-Type': 'application/json'
	// 	},
	// 	contentType: 'json'
	// };
	// // for 1st col only 'https://sheets.googleapis.com/v4/spreadsheets/1tktdZKgC3RgPJHJ0eEKRSxaGt9CskvbA0jEE5ynyLHQ/values/sheet1!A1%3AA?majorDimension=COLUMNS&valueRenderOption=FORMATTED_VALUE&key=[YOUR_API_KEY]'
	// fetch(
	// 	'https://sheets.googleapis.com/v4/spreadsheets/1tktdZKgC3RgPJHJ0eEKRSxaGt9CskvbA0jEE5ynyLHQ/values/sheet1?key=AIzaSyAzM0wR7oql6w40Cv2lnizenVsFl9BL0mg',
	// 	init
	// )
	// 	.then(response => response.json())
	// 	.then(function (data) {
	// 		console.log(data);
	// 	});
	// let post_init = {
	// 	method: 'POST',
	// 	async: true,
	// 	headers: {
	// 		Authorization: 'Bearer ' + token,
	// 		'Content-Type': 'application/json'
	// 	},
	// 	contentType: 'json',
	// 	body: JSON.stringify({
	// 		values: [
	// 			['asda', 'asdasd'],
	// 			['123', '456']
	// 		]
	// 	})
	// };
	// fetch(
	// 	'https://sheets.googleapis.com/v4/spreadsheets/1tktdZKgC3RgPJHJ0eEKRSxaGt9CskvbA0jEE5ynyLHQ/values/sheet1:append?valueInputOption=RAW&key=AIzaSyAzM0wR7oql6w40Cv2lnizenVsFl9BL0mg',
	// 	post_init
	// )
	// 	.then(response => response.json())
	// 	.then(data => console.log(data));
}
// ${chrome.identity.getRedirectURL('app')}
// chrome.identity.clearAllCachedAuthTokens(() => console.log('cleared'));
console.log(chrome.identity.getRedirectURL());
// 'https://www.facebook.com/dialog/oauth?client_id=832160787350025&response_type=token&redirect_uri=' +
// chrome.identity.getRedirectURL(),

// window.addEventListener('load', function () {
// 	chrome.identity.launchWebAuthFlow(options, url => {
// 		const access_token = url.split('#')[1].split('&')[0].split('=')[1];
// 		console.log(access_token);
// 	});
// });

// .then(function (url) {
// 			console.log(url);
// 			let token = new URL(url).hash.match(/(access\_token=)(.*)(&)/)[2];
// 			window
// 				.fetch(
// 					'https://graph.facebook.com/me?fields=id,name&access_token=' + token
// 				)
// 				.then(function (response) {
// 					// Parse the response body of the promise
// 					response.json().then(function (data) {
// 						console.log(data);
// 						// -> {id: "<your-user-id>", name: "<your-name>"}
// 					});
// 				});
// 		})
// 		.catch(function (error) {
// 			console.error(error);
// 		});

// const fb_access_token =
// 	'EAAL02IggQgkBAJvJkfolfaCytXCKrnIuAZCMdMBIGHLnJ78jsZChHXdWbH0wr4XZAzWVAkVqbY3RBCYGfG28NnQdy2ZC1oTXBjvJVIMihHOrvs49f3imLcWz0BcSdgZC9eZA8ubVygBByJP9dkTJCAvT3WmLMZBLRaTaZChAasyDTFCRwbXv0SXjEYcGkllAZCloZD';
// const fb_graph_url = 'https://graph.facebook.com/v9.0/';

// const s = document.createElement('script');
// s.setAttribute('src', 'https://connect.facebook.net/en_US/sdk.js');
// document.body.appendChild(s);

// window.fbAsyncInit = function () {
// 	FB.init({
// 		appId: '832160787350025',
// 		autoLogAppEvents: true,
// 		xfbml: true,
// 		version: 'v9.0'
// 	});

// 	console.log(FB);
// 	FB.getUserID();
// 	FB.api('/me/groups', 'GET', {}, function (response) {
// 		console.log(response);
// 	});
// };

// fetch(`${fb_graph_url}me?fields=id%2Cname&access_token=${fb_access_token}`)
// 	.then(response => response.text())
// 	.then(response => console.log(response))
// 	.catch(error => console.log(error));

// fetch(`${fb_graph_url}me/groups?access_token=${fb_access_token}`)
// 	.then(response => response.text())
// 	.then(response => console.log(response))
// 	.catch(error => console.log(error));

// fetch(`${fb_graph_url}3760667350659488/feed?access_token=${fb_access_token}`)
// 	.then(response => response.text())
// 	.then(response => console.log(response))
// 	.catch(error => console.log(error));
