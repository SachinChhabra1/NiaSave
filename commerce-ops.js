// Legacy bookmark destination, including localhost. Central owns operations.
if (new URLSearchParams(location.search).get('view') === 'commerce') {
  location.replace('https://rafiqicentral.com/member-commerce?line=save');
}
