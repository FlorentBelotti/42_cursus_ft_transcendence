document.addEventListener('DOMContentLoaded', function () {
	const modal = document.getElementById('verifyModal');
	const closeModal = document.querySelector('.close-modal');

	if (modal && closeModal){
		closeModal.addEventListener('click', function () {
			console.log("Croix cliquée")
			modal.style.display = 'none';
		});
	}else{
		console.error("Modal ou closeModal non trouvé dans le DOM")
	}

});

