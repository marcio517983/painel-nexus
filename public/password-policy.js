export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 256 || !/\p{Lu}/u.test(password) || !/\p{Ll}/u.test(password) || !/[^\p{L}\p{N}\s]/u.test(password)) {
    throw new Error('Use de 8 a 256 caracteres, com letra maiúscula, minúscula e caractere especial (como @, # ou !).');
  }
}
