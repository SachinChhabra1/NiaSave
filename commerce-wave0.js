document.addEventListener('click', event => {
  const onSavePhoto = event.target.closest('.mesha-save-hero, .photo-button, .photo');
  const homeBrand = event.target.closest('[data-action="home"]');
  if (onSavePhoto && homeBrand) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
  if (onSavePhoto && location.hash !== '#shop') history.replaceState(null, '', '#shop');
}, true);
