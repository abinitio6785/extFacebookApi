const welcomeMessage = document.querySelector('#welcome-message');
const logoutButton = document.querySelector('#logout');
const fetchPostsButton = document.querySelector('#fetch-posts');
const authorizeFacebookButton = document.querySelector('#authorize-facebook');
const header = document.querySelector('.header');

authorizeFacebookButton.addEventListener('click', () => {
	console.log('authorize facebook');
	chrome.runtime.sendMessage({ todo: 'authorize_facebook' }, data => {
		updateWelcomeMessage(data.name);
		toggleHeader();
		toggleFetchPostsButton();
		toggleAuthorizeFacebookButton();
	});
});

fetchPostsButton.addEventListener('click', () => {
	chrome.runtime.sendMessage({
		todo: 'fetch_posts',
		values: {
			postCount: 20,
			interval: 30
		}
	});
});

logoutButton.addEventListener('click', () => {
	chrome.runtime.sendMessage({ todo: 'logout' });
	toggleHeader();
	toggleAuthorizeFacebookButton();
	toggleFetchPostsButton();
});

window.addEventListener('load', function () {
	chrome.runtime.sendMessage({ todo: 'check_auth_status' }, data => {
		if (data.id) {
			updateWelcomeMessage(data.name);
			toggleHeader();
			toggleFetchPostsButton();
			toggleAuthorizeFacebookButton();
		}
	});
});

function updateWelcomeMessage(name) {
	welcomeMessage.innerText = `Welcome ${name}`;
}

function toggleHeader() {
	header.classList.toggle('show');
}

function toggleFetchPostsButton() {
	fetchPostsButton.classList.toggle('show');
}

function toggleAuthorizeFacebookButton() {
	authorizeFacebookButton.classList.toggle('show');
}
