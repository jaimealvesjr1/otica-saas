export const formatarCPF = (valor: string) => {
  // Remove tudo o que não é número
  let v = valor.replace(/\D/g, '');
  
  // Limita a 11 números
  if (v.length > 11) v = v.substring(0, 11);

  // Coloca os pontos e o traço
  if (v.length > 9) {
    v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  } else if (v.length > 6) {
    v = v.replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3");
  } else if (v.length > 3) {
    v = v.replace(/(\d{3})(\d{1,3})/, "$1.$2");
  }
  return v;
};

export const formatarCNPJ = (valor: string) => {
  let v = valor.replace(/\D/g, '');
  if (v.length > 14) v = v.substring(0, 14);

  if (v.length > 12) {
    v = v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  } else if (v.length > 8) {
    v = v.replace(/(\d{2})(\d{3})(\d{3})(\d{1,4})/, "$1.$2.$3/$4");
  } else if (v.length > 5) {
    v = v.replace(/(\d{2})(\d{3})(\d{1,3})/, "$1.$2.$3");
  } else if (v.length > 2) {
    v = v.replace(/(\d{2})(\d{1,3})/, "$1.$2");
  }
  return v;
};

export const formatarTelefone = (valor: string) => {
  let v = valor.replace(/\D/g, '');
  if (v.length > 11) v = v.substring(0, 11);

  if (v.length > 10) {
    // Celular: (99) 99999-9999
    v = v.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  } else if (v.length > 6) {
    // Fixo: (99) 9999-9999
    v = v.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
  } else if (v.length > 2) {
    v = v.replace(/(\d{2})(\d{1,5})/, "($1) $2");
  }
  return v;
};

export const formatarGrau = (valor: string) => {
  // Permite apenas números, vírgula, sinal de + e -
  return valor.replace(/[^0-9,\-+]/g, ""); 
};
