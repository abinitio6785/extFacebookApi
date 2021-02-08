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
// const apiUrl = 'https://6930cab9f168.ngrok.io/';

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

			postsCount.value = response.data.postCount;
			interval.value = response.data.interval;
			addUserField(response.data.name);
			addFacebookGroups(
				response.data.userFacebookGroups,
				response.data.groupsToSheets
			);
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
			paragraph.innerText = response.data.status;
			paragraph.classList.add(response.data.type);
			appStatus.appendChild(paragraph);
			updateSetting.classList.add('show');
			authorizeFacebook.classList.remove('show');
			postsCount.value = response.data.postCount;
			interval.value = response.data.interval;

			addUserField(response.data.name);
			addFacebookGroups(
				response.data.userFacebookGroups,
				response.data.groupsToSheets
			);
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
		const groupsTable = sheetsList.querySelector('.facebook-groups');
		if (groupsTable) {
			sheetsListHeader.classList.remove('show');
			groupsTable.remove();
		} else {
			sheetsList.querySelector('.no-groups-header').remove();
		}
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
		let error = false;
		const postBody = {
			postCount: '',
			interval: '',
			groupsToSheets: []
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

		const table = document.querySelector('.facebook-groups');
		tableData = table.querySelectorAll('.table-data');
		tableData.forEach(data => {
			const id = data.querySelector('.group-id').innerText;
			const name = data.querySelector('.group-name').innerText;
			const googleSheetUrl = data.querySelector('.google-sheet-url').value;
			postBody.groupsToSheets.push({ id, name, googleSheetUrl });
		});

		if (!error) {
			const response = await axios.post(`${apiUrl}updateSettings`, postBody);
			console.log(response.data);
			if (response.data.status === 'updated') {
				updateMessage.classList.add('show');
				const messageParagraph = updateMessage.querySelector('p');
				messageParagraph.innerText = response.data.message;
				messageParagraph.classList.add('info');
				setTimeout(() => {
					updateMessage.classList.remove('show');
				}, 5000);
			} else {
				updateMessage.classList.add('show');
				const messageParagraph = updateMessage.querySelector('p');
				if (response.data.message) {
					messageParagraph.innerText = response.data.message;
					messageParagraph.classList.add('error');
				} else {
					messageParagraph.innerText =
						'Something went wrong. App settings not updated.';
					messageParagraph.classList.add('error');
				}
				setTimeout(() => {
					updateMessage.classList.remove('show');
				}, 5000);
			}
		}
	} catch (error) {
		console.log(error);
	}
});

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

function addFacebookGroups(facebookGroups, groupsToSheets) {
	if (facebookGroups.length) {
		sheetsListHeader.classList.add('show');
		const table = document.createElement('table');
		table.classList.add('facebook-groups');
		const tableHeading = `
							<tr>
								<th>S. No</th>
								<th>Group Id</th>
								<th>Group Name</th>
								<th>Google Sheet Url</th>
							</tr>
							`;
		table.innerHTML += tableHeading;
		let tableBody = '';
		facebookGroups.forEach((group, index) => {
			const data = groupsToSheets.filter(
				sheetData => sheetData.id === group.id
			);
			const inputValue = data.length ? data[0].googleSheetUrl : '';
			tableBody += `
						<tr class='table-data'>
							<td>${index + 1}</td>
							<td class="group-id">${group.id}</td>
							<td class="group-name">${group.name}</td>
							<td>
								<input type='text' placeholder="Google Sheet Url"  class="google-sheet-url" value=${inputValue}>
							</td>
						</tr>
						`;
		});
		table.innerHTML += tableBody;

		sheetsList.appendChild(table);
	} else {
		const p = document.createElement('p');
		p.classList.add('no-groups-header');
		p.innerText = 'No groups found';

		sheetsList.appendChild(p);
	}
}
