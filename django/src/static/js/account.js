function initAccountPage() {
    // Username change
    const showUsernameFormButton = document.getElementById('show-username-form');
    const usernameForm = document.getElementById('username-form');
    const cancelUsernameButton = document.getElementById('cancel-username');

    if (showUsernameFormButton && usernameForm && cancelUsernameButton) {
        showUsernameFormButton.addEventListener('click', function() {
            usernameForm.style.display = 'block';
        });

        cancelUsernameButton.addEventListener('click', function() {
            usernameForm.style.display = 'none';
        });
    }

    // Password change
    const showPasswordFormButton = document.getElementById('show-password-form');
    const passwordForm = document.getElementById('password-form');
    const cancelPasswordButton = document.getElementById('cancel-password');

    if (showPasswordFormButton && passwordForm && cancelPasswordButton) {
        showPasswordFormButton.addEventListener('click', function() {
            passwordForm.style.display = 'block';
        });

        cancelPasswordButton.addEventListener('click', function() {
            passwordForm.style.display = 'none';
        });
    }

    // Delete account
    const showDeleteAccountButton = document.getElementById('show-delete-account');
    const deleteAccountConfirm = document.getElementById('delete-account-confirm');
    const cancelDeleteButton = document.getElementById('cancel-delete');

    if (showDeleteAccountButton && deleteAccountConfirm && cancelDeleteButton) {
        showDeleteAccountButton.addEventListener('click', function() {
            deleteAccountConfirm.style.display = 'block';
        });

        cancelDeleteButton.addEventListener('click', function() {
            deleteAccountConfirm.style.display = 'none';
        });
    }
}

document.addEventListener('DOMContentLoaded', initAccountPage);