const updateSetting = document.querySelector('#update-settings');
const authorizeFacebook = document.querySelector('#authorize-facebook');
const postsCount = document.querySelector('#posts-count');
const interval = document.querySelector('#interval');
const appStatus = document.querySelector('#app-status');
const updateMessage = document.querySelector('.update-message');
const user = document.querySelector('#user');
const sheetsList = document.querySelector('#sheets-list');
const sheetsListHeader = document.querySelector('#sheets-list-header');
const addSheet = document.querySelector('#add-sheet');
const apiUrl = 'https://extfacebookapi.stagingwebsites.info/';
// const apiUrl = 'https://0ae7d1ac2d25.ngrok.io/';

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
			paragraph.innerText = response.data.message;
			paragraph.classList.add(response.data.type);
			appStatus.appendChild(paragraph);

			addUserField(response.data.name);
			addSheetList(response.data.sheets);

			postsCount.value = response.data.postCount;
			interval.value = response.data.interval;
		} else {
			authorizeFacebook.classList.add('show');
			const paragraph = document.createElement('p');
			paragraph.innerText = response.data.message;
			paragraph.classList.add(response.data.type);
			appStatus.appendChild(paragraph);
		}
	} catch (error) {}
}

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
			paragraph.innerText = 'App is running.';
			paragraph.classList.add('ok');
			appStatus.appendChild(paragraph);
			updateSetting.classList.add('show');
			authorizeFacebook.classList.remove('show');

			sheetsListHeader.classList.add('show');
			sheetsList.appendChild(sheetsListHeader);
			addUserField(response.data.name);
			addSheetList(response.data.sheets);
			postsCount.value = response.data.postCount;
			interval.value = response.data.interval;
		} else {
			appStatus.removeChild(appStatus.querySelector('p'));
			const paragraph = document.createElement('p');
			paragraph.innerText =
				'Something went wrong. User Token could not be updated.';
			paragraph.classList.add('error');
		}
	} catch (error) {
		console.log(error);
	}
}

function addUserField(userName) {
	const paragraph = document.createElement('p');
	paragraph.innerText = `Welcome ${userName || ''}`;

	const logout = document.createElement('button');
	logout.innerText = 'Logout';
	logout.classList.add('logout');

	logout.addEventListener('click', () => {
		logoutUser();
	});

	user.appendChild(paragraph);
	user.appendChild(logout);
}

async function logoutUser() {
	try {
		const response = await axios.post(`${apiUrl}logout`, {});
		user.innerHTML = '';
		sheetsList.innerHTML = '';
		postsCount.value = '';
		interval.value = '';
		appStatus.removeChild(appStatus.querySelector('p'));
		const paragraph = document.createElement('p');
		paragraph.innerText = 'User token not found. Please update token.';
		paragraph.classList.add('error');
		appStatus.appendChild(paragraph);
		updateSetting.classList.remove('show');
		authorizeFacebook.classList.add('show');
	} catch (error) {
		console.log(error);
	}
}

updateSetting.addEventListener('click', async () => {
	try {
		const sheets = sheetsList.querySelectorAll('.sheet');
		let error = false;
		const postBody = {
			postCount: '',
			interval: '',
			sheets: []
		};

		if (postsCount.value === '') {
			setErrors(postsCount, 'Post Count is required');
			error = true;
		} else {
			if (checkForNumber(postsCount.value)) {
				if (postsCount.value === '0') {
					setErrors(postsCount, 'Post Count cannot be 0');
					error = true;
				} else {
					unsetErrors(postsCount);
				}
				postBody.postCount = postsCount.value;
			} else {
				setErrors(postsCount, 'Post Count must be a number');
				error = true;
			}
		}

		if (interval.value === '') {
			setErrors(interval, 'Interval is required');
			error = true;
		} else {
			if (checkForNumber(interval.value)) {
				if (interval.value === '0') {
					setErrors(interval, 'Interval cannot be 0');
					error = true;
				} else {
					unsetErrors(interval);
				}
				postBody.interval = interval.value;
			} else {
				setErrors(interval, 'Interval must be a number');
				error = true;
			}
		}

		sheets.forEach(sheet => {
			const from = sheet.querySelector('.from');
			const to = sheet.querySelector('.to');
			const googleSheetID = sheet.querySelector('.google-sheet-id');

			if (from.value === '') {
				setErrors(from, 'Facebook group from value is required');
				error = true;
			} else {
				if (checkForNumber(from.value)) {
					if (from.value === '0') {
						setErrors(from, 'Facebook group from value cannot be 0');
						error = true;
					} else {
						unsetErrors(from);
					}
				} else {
					setErrors(from, 'Facebook group from value must be a number');
					error = true;
				}
			}

			if (to.value === '') {
				setErrors(to, 'Facebook group to value is required');
				error = true;
			} else {
				if (checkForNumber(to.value)) {
					if (to.value === '0') {
						setErrors(to, 'Facebook group to value cannot be 0');
						error = true;
					} else {
						unsetErrors(to);
					}
				} else {
					setErrors(to, 'Facebook group to value must be a number');
					error = true;
				}
			}

			if (googleSheetID.value === '') {
				error = true;
				setErrors(googleSheetID, 'Google Sheet ID is required');
			} else {
				unsetErrors(googleSheetID);
			}

			postBody.sheets.push({
				from: from.value,
				to: to.value,
				googleSheetID: googleSheetID.value
			});
		});

		if (!error) {
			// console.log(error, postBody);
			const response = await axios.post(`${apiUrl}updateSettings`, postBody);
			console.log(response);
			if (response.data.message === 'updated') {
				updateMessage.classList.add('show');
				setTimeout(() => {
					updateMessage.classList.remove('show');
				}, 5000);
			}
		}
	} catch (error) {
		console.log(error);
	}
});

function addSheetList(sheets) {
	sheets.forEach(sheetData => {
		const sheet = document.createElement('div');
		sheet.classList.add('sheet');

		const formControl = document.createElement('div');
		formControl.classList.add('form-control');

		const formGroup = document.createElement('div');
		formGroup.classList.add('form-group');

		const fromFormGroup = createFormGroup(
			'Facebook Group From',
			'Facebook Group From',
			'from'
		);
		fromFormGroup.querySelector('.from').value = sheetData.from;

		const toFormGroup = createFormGroup(
			'Facebook Group To',
			'Facebook Group To',
			'to'
		);
		toFormGroup.querySelector('.to').value = sheetData.to;

		const googleSheetIDFormGroup = createFormGroup(
			'Google Sheet',
			'Google Sheet',
			'google-sheet-id'
		);

		googleSheetIDFormGroup.querySelector('.google-sheet-id').value =
			sheetData.googleSheetID;

		const trash = document.createElement('button');
		trash.classList.add('delete');
		trash.innerText = 'X';

		trash.addEventListener('click', e => {
			deleteSheetDetails(e.target);
		});

		formControl.appendChild(fromFormGroup);
		formControl.appendChild(toFormGroup);
		formControl.appendChild(googleSheetIDFormGroup);
		formControl.appendChild(trash);
		sheet.appendChild(formControl);
		sheetsList.appendChild(sheet);
	});
}

function addSheetHandler() {
	const sheet = document.createElement('div');
	sheet.classList.add('sheet');

	const formControl = document.createElement('div');
	formControl.classList.add('form-control');

	const formGroup = document.createElement('div');
	formGroup.classList.add('form-group');

	const fromFormGroup = createFormGroup(
		'Facebook Group From',
		'Facebook Group From',
		'from'
	);

	const toFormGroup = createFormGroup(
		'Facebook Group To',
		'Facebook Group To',
		'to'
	);

	const googleSheetIDFormGroup = createFormGroup(
		'Google Sheet',
		'Google Sheet',
		'google-sheet-id'
	);

	const trash = document.createElement('button');
	trash.classList.add('delete');
	trash.innerText = 'X';

	trash.addEventListener('click', e => {
		deleteSheetDetails(e.target);
	});

	formControl.appendChild(fromFormGroup);
	formControl.appendChild(toFormGroup);
	formControl.appendChild(googleSheetIDFormGroup);
	formControl.appendChild(trash);
	sheet.appendChild(formControl);
	sheetsList.appendChild(sheet);
}

function createFormGroup(labelText, inputFieldPlaceHolder, className) {
	const formGroup = document.createElement('div');
	formGroup.classList.add('form-group');

	const formField = document.createElement('div');
	formField.classList.add('form-field');

	const error = document.createElement('div');
	error.classList.add('error');

	const span = document.createElement('span');
	span.innerText = 'Error';
	error.appendChild(span);

	const label = document.createElement('label');
	label.innerText = `${labelText}:`;
	const inputField = document.createElement('input');
	inputField.setAttribute('type', 'text');
	inputField.setAttribute('placeholder', inputFieldPlaceHolder);
	inputField.classList.add(className);
	formField.appendChild(label);
	formField.appendChild(inputField);

	formGroup.appendChild(formField);
	formGroup.appendChild(error);
	return formGroup;
}

function deleteSheetDetails(htmlNode) {
	const formControl = htmlNode.parentElement;
	const sheet = formControl.parentElement;
	sheet.remove();
}

function checkForNumber(number) {
	const reg = /^\d+$/;
	return reg.test(number);
}

function setErrors(htmlNode, errorText) {
	const formField = htmlNode.parentElement;
	const formGroup = formField.parentElement;
	const error = formGroup.querySelector('.error');
	const span = error.querySelector('span');
	span.innerText = errorText;
	error.classList.add('show');
}

function unsetErrors(htmlNode) {
	const formField = htmlNode.parentElement;
	const formGroup = formField.parentElement;
	const error = formGroup.querySelector('.error');
	const span = error.querySelector('span');
	span.innerText = '';
	error.classList.remove('show');
}

addSheet.addEventListener('click', () => {
	addSheetHandler();
});
