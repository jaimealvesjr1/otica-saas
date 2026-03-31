import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export async function obterProximoCodigo(nomeColecao: string): Promise<number> {
  const q = query(collection(db, nomeColecao), orderBy('codigo', 'desc'), limit(1));
  const snap = await getDocs(q);
  
  if (snap.empty) return 1; // Se a gaveta estiver vazia, é o número 1
  return Number(snap.docs[0].data().codigo) + 1; // Pega o último e soma 1
}

// Transforma o número 1 em "001" visualmente
export function formatarCodigo(codigo: number): string {
  return String(codigo).padStart(3, '0');
}
