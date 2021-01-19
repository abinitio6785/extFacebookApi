const options = {
	url:
		'https://www.facebook.com/dialog/oauth?client_id=832160787350025&response_type=token&redirect_uri=' +
		chrome.identity.getRedirectURL(),
	interactive: true
};

window.addEventListener('load', function () {
	chrome.identity
		.launchWebAuthFlow(options)
		.then(function (url) {
			let token = new URL(url).hash.match(/(access\_token=)(.*)(&)/)[2];
			window
				.fetch(
					'https://graph.facebook.com/me?fields=id,name&access_token=' + token
				)
				.then(function (response) {
					// Parse the response body of the promise
					response.json().then(function (data) {
						console.log(data);
						// -> {id: "<your-user-id>", name: "<your-name>"}
					});
				});
		})
		.catch(function (error) {
			console.error(error);
		});
});

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
