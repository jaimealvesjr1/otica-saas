import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCHzwCJneX8akKZL1MAYXx6KNBHYj_ZDGE",
  authDomain: "otica-saas.firebaseapp.com",
  projectId: "otica-saas",
  storageBucket: "otica-saas.firebasestorage.app",
  messagingSenderId: "215128146252",
  appId: "1:215128146252:web:5d7087a4d38f77127d0fe9"
};

// 1. Inicializa o aplicativo Firebase
const app = initializeApp(firebaseConfig);

// 2. Exporta o serviço de Autenticação (para login de Admin e Vendedores)
export const auth = getAuth(app);

// 3. Exporta o Banco de Dados Firestore (para salvar Vendas, Estoque, Clientes)
export const db = getFirestore(app);
