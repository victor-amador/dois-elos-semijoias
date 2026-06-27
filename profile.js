const profileForm = document.querySelector("[data-profile-form]");
const addressForm = document.querySelector("[data-address-form]");
const addressList = document.querySelector("[data-address-list]");
const statusBox = document.querySelector("[data-profile-status]");
const profileKey = "doisElosProfile";
const addressKey = "doisElosAddresses";

function loadProfile() {
  const customer = JSON.parse(localStorage.getItem(customerStorageKey) || "{}");
  const profile = JSON.parse(localStorage.getItem(profileKey) || "{}");
  const merged = { ...customer, ...profile };
  Object.entries(merged).forEach(([key, value]) => {
    const field = profileForm?.elements[key];
    if (field) field.value = value || "";
  });
}

function renderAddresses() {
  const addresses = JSON.parse(localStorage.getItem(addressKey) || "[]");
  addressList.innerHTML = addresses.length
    ? addresses.map((item, index) => `<article><strong>${item.label}</strong><span>${item.cep}</span><span>${item.address}</span><button type="button" data-remove-address="${index}">Excluir</button></article>`).join("")
    : "<p>Nenhum endereco cadastrado.</p>";
}

profileForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const profile = Object.fromEntries(new FormData(profileForm));
  localStorage.setItem(profileKey, JSON.stringify(profile));
  const customer = JSON.parse(localStorage.getItem(customerStorageKey) || "{}");
  localStorage.setItem(customerStorageKey, JSON.stringify({ ...customer, name: profile.name, email: profile.email }));
  statusBox.textContent = "Perfil salvo.";
});

addressForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const addresses = JSON.parse(localStorage.getItem(addressKey) || "[]");
  addresses.push(Object.fromEntries(new FormData(addressForm)));
  localStorage.setItem(addressKey, JSON.stringify(addresses));
  addressForm.reset();
  renderAddresses();
});

addressList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-address]");
  if (!button) return;
  const addresses = JSON.parse(localStorage.getItem(addressKey) || "[]");
  addresses.splice(Number(button.dataset.removeAddress), 1);
  localStorage.setItem(addressKey, JSON.stringify(addresses));
  renderAddresses();
});

loadProfile();
renderAddresses();
