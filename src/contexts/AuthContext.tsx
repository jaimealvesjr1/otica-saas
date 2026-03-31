// src/contexts/AuthContext.tsx
import { collection, query, where, getDocs } from 'firebase/firestore';
import { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';

interface AppUser {
  uid: string;
  email: string | null;
  cargo: 'admin' | 'vendedor' | null;
  nome: string; // Adicionamos o nome!
}

const AuthContext = createContext<{ user: AppUser | null; loading: boolean }>({ user: null, loading: true });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
      if (firebaseUser && firebaseUser.email) {
        
        // NOVO: Busca na coleção colaboradores onde o email for igual ao do login
        const q = query(collection(db, 'colaboradores'), where('email', '==', firebaseUser.email));
        const querySnapshot = await getDocs(q);
        
        let dadosColaborador: any = {};
        if (!querySnapshot.empty) {
          dadosColaborador = querySnapshot.docs[0].data(); // Pega o primeiro resultado encontrado
        }

        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          cargo: dadosColaborador.cargo || 'vendedor',
          nome: dadosColaborador.nome || firebaseUser.email.split('@')[0],
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
