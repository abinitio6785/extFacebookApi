const updateSetting = document.querySelector('#update-settings');
const authorizeFacebook = document.querySelector('#authorize-facebook');
const postsCount = document.querySelector('#posts-count');
const interval = document.querySelector('#interval');
const appStatus = document.querySelector('#app-status');
const updateMessage = document.querySelector('.update-message');
const user = document.querySelector('#user');

const apiUrl = 'https://extfacebookapi.stagingwebsites.info/';
// const apiUrl = 'https://e31d2bc7fd65.ngrok.io/';

window.fbAsyncInit = function () {
	FB.init({
		appId: '416734862717444',
		autoLogAppEvents: true,
		xfbml: true,
		version: 'v9.0'
	});

	getAppStatus();
};

async function getAppStatus() {
	try {
		const response = await axios.get(`${apiUrl}appStatus`);
		if (response.data.status === 'active') {
			updateSetting.classList.add('show');
			const paragraph = document.createElement('p');
			paragraph.innerText = 'App status is ok.';
			paragraph.classList.add('ok');
			appStatus.appendChild(paragraph);
			addUserField(response.data.name);
		} else {
			authorizeFacebook.classList.add('show');
			const paragraph = document.createElement('p');
			paragraph.innerText = 'User Token expired. Please update token.';
			paragraph.classList.add('error');
			appStatus.appendChild(paragraph);
		}
	} catch (error) {}
}

updateSetting.addEventListener('click', e => {
	e.preventDefault();
	const postsCountValue = postsCount.value;
	const intervalValue = interval.value;

	updateSettings(postsCountValue, intervalValue);
});

authorizeFacebook.addEventListener('click', e => {
	e.preventDefault();
	FB.login(
		function (response) {
			console.log(response);
			if (response.authResponse) {
				updateToken(response.authResponse.accessToken);
			}
		},
		{ scope: 'email,publish_to_groups,groups_access_member_info' }
	);
});

async function updateToken(token) {
	try {
		const response = await axios.post(`${apiUrl}updateToken`, {
			token
		});
		if (response.data.message === 'updated') {
			appStatus.removeChild(appStatus.querySelector('p'));
			const paragraph = document.createElement('p');
			paragraph.innerText = 'App status is ok.';
			paragraph.classList.add('ok');
			appStatus.appendChild(paragraph);
			updateSetting.classList.add('show');
			authorizeFacebook.classList.remove('show');
			addUserField(response.data.name);
		}
	} catch (error) {
		console.log(error);
	}
}

async function updateSettings(postsCount, interval) {
	try {
		const response = await axios.post(`${apiUrl}updateSettings`, {
			postsCount,
			interval
		});
		if (response.data.message === 'updated') {
			updateMessage.classList.add('show');
			setInterval(() => {
				updateMessage.classList.remove('show');
			}, 3000);
		}
	} catch (error) {
		console.log(error);
	}
}

function addUserField(userName) {
	const paragraph = document.createElement('p');
	paragraph.innerText = `Welcome ${userName}`;
	const button = document.createElement('button');
	button.innerText = 'Logout';
	button.classList.add('logout');

	button.addEventListener('click', () => {
		logoutUser();
	});
	user.appendChild(paragraph);
	user.appendChild(button);
}

async function logoutUser() {
	try {
		const response = await axios.post(`${apiUrl}logout`, {});
		console.log('asdasd');
		user.innerHTML = '';
		appStatus.removeChild(appStatus.querySelector('p'));
		const paragraph = document.createElement('p');
		paragraph.innerText = 'User Token expired. Please update token.';
		paragraph.classList.add('error');
		appStatus.appendChild(paragraph);
		updateSetting.classList.remove('show');
		authorizeFacebook.classList.add('show');
	} catch (error) {
		console.log(error);
	}
}
