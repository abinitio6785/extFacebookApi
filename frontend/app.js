const updateSetting = document.querySelector('#update-settings');
const authorizeFacebook = document.querySelector('#authorize-facebook');
const postsCount = document.querySelector('#posts-count');
const interval = document.querySelector('#interval');
const appStatus = document.querySelector('#app-status');
const updateMessage = document.querySelector('.update-message');
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
		const response = await axios.get(
			'https://extfacebookapi.stagingwebsites.info/appStatus'
		);
		if (response.data.status === 'active') {
			updateSetting.classList.add('show');
			const paragraph = document.createElement('p');
			paragraph.innerText = 'App status is ok.';
			paragraph.classList.add('ok');
			appStatus.appendChild(paragraph);
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
		const response = await axios.post(
			'https://extfacebookapi.stagingwebsites.info/updateToken',
			{
				token
			}
		);
		if (response.data.message === 'updated') {
			appStatus.removeChild(appStatus.querySelector('p'));
			const paragraph = document.createElement('p');
			paragraph.innerText = 'App status is ok.';
			paragraph.classList.add('ok');
			appStatus.appendChild(paragraph);
			updateSetting.classList.add('show');
			authorizeFacebook.classList.remove('show');
		}
	} catch (error) {}
}

async function updateSettings(postsCount, interval) {
	try {
		const response = await axios.post(
			'https://extfacebookapi.stagingwebsites.info/updateSettings',
			{
				postsCount,
				interval
			}
		);
		if (response.data.message === 'updated') {
			updateMessage.classList.add('show');
			setInterval(() => {
				updateMessage.classList.remove('show');
			}, 3000);
		}
	} catch (error) {}
}
