// const options = {
// 	url: `https://www.facebook.com/v9.0/dialog/oauth?client_id=832160787350025&redirect_uri=https://agladpmnpjheedkebempldldhjnadakl.chromiumapp.org/&response_type=token&scope=public_profile,email,publish_to_groups,groups_access_member_info`,
// 	interactive: true
// };

chrome.identity.getAuthToken({ interactive: true }, getSheetData);

function getSheetData(token) {
	let init = {
		method: 'GET',
		async: true,
		headers: {
			Authorization: 'Bearer ' + token,
			'Content-Type': 'application/json'
		},
		contentType: 'json'
	};

	// for 1st col only 'https://sheets.googleapis.com/v4/spreadsheets/1tktdZKgC3RgPJHJ0eEKRSxaGt9CskvbA0jEE5ynyLHQ/values/sheet1!A1%3AA?majorDimension=COLUMNS&valueRenderOption=FORMATTED_VALUE&key=[YOUR_API_KEY]'

	fetch(
		'https://sheets.googleapis.com/v4/spreadsheets/1tktdZKgC3RgPJHJ0eEKRSxaGt9CskvbA0jEE5ynyLHQ/values/sheet1?key=AIzaSyCyis6s2JvCMCt1vEzuE7GDvT5LVn_8aSs',
		init
	)
		.then(response => response.json())
		.then(function (data) {
			console.log(data);
		});

	let post_init = {
		method: 'POST',
		async: true,
		headers: {
			Authorization: 'Bearer ' + token,
			'Content-Type': 'application/json'
		},
		contentType: 'json',
		body: JSON.stringify({
			values: [
				['asda', 'asdasd'],
				['123', '456']
			]
		})
	};

	fetch(
		'https://sheets.googleapis.com/v4/spreadsheets/1tktdZKgC3RgPJHJ0eEKRSxaGt9CskvbA0jEE5ynyLHQ/values/sheet1:append?valueInputOption=RAW&key=AIzaSyCyis6s2JvCMCt1vEzuE7GDvT5LVn_8aSs',
		post_init
	)
		.then(response => response.json())
		.then(data => console.log(data));
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
