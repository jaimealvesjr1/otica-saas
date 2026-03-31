import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs } from 'firebase/firestore';

export default function Estoque() {
  const [produtos, setProdutos] = useState<any[]>([]);
  const [fornecedores, setFornecedores] = useState<any[]>([]);
  
  // Campos
  const [nome, setNome] = useState('');
  const [referencia, setReferencia] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [valorUnitario, setValorUnitario] = useState('');
  const [dataEntrada, setDataEntrada] = useState('');
  const [fornecedorBusca, setFornecedorBusca] = useState('');

  const carregarDados = async () => {
    const prodSnap = await getDocs(collection(db, 'estoque'));
    setProdutos(prodSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    
    const fornSnap = await getDocs(collection(db, 'fornecedores'));
    setFornecedores(fornSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  useEffect(() => { carregarDados(); }, []);

  const cadastrarProduto = async (e: React.FormEvent) => {
    e.preventDefault();
    await addDoc(collection(db, 'estoque'), {
      nome, referencia, quantidade: parseInt(quantidade), 
      valorUnitario: parseFloat(valorUnitario.replace(',', '.')), 
      dataEntrada, fornecedor: fornecedorBusca
    });
    alert('Produto salvo no estoque!');
    setNome(''); setReferencia(''); setQuantidade(''); setValorUnitario(''); setDataEntrada(''); setFornecedorBusca('');
    carregarDados();
  };

  return (
    <div>
      <h2>📦 Controle de Estoque</h2>
      <div className="card-formulario">
        <form onSubmit={cadastrarProduto} style={{ display: 'grid', gap: '15px', gridTemplateColumns: '1fr 1fr' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Nome do Produto / Lente</label>
            <input type="text" value={nome} onChange={e => setNome(e.target.value)} required />
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Referência / Código</label>
            <input type="text" value={referencia} onChange={e => setReferencia(e.target.value)} required />
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Fornecedor (Digite para buscar)</label>
            <input type="text" list="lista-fornecedores" value={fornecedorBusca} onChange={e => setFornecedorBusca(e.target.value)} required placeholder="Ex: Ótica Vision..." />
            <datalist id="lista-fornecedores">
              {fornecedores.map(f => <option key={f.id} value={f.nome} />)}
            </datalist>
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Data de Entrada</label>
            <input type="date" value={dataEntrada} onChange={e => setDataEntrada(e.target.value)} required />
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Quantidade (Unidades)</label>
            <input type="number" value={quantidade} onChange={e => setQuantidade(e.target.value)} required />
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Valor de Venda (R$)</label>
            <input type="text" value={valorUnitario} onChange={e => setValorUnitario(e.target.value)} required />
          </div>
          <button type="submit" style={{ gridColumn: 'span 2' }}>Adicionar ao Estoque</button>
        </form>
      </div>

      <table style={{ marginTop: '20px' }}>
        <thead><tr><th>Data Entrada</th><th>Produto</th><th>Ref</th><th>Fornecedor</th><th>Qtd</th><th>Valor (R$)</th></tr></thead>
        <tbody>
          {produtos.map(p => (
            <tr key={p.id}>
              <td>{p.dataEntrada?.split('-').reverse().join('/')}</td><td>{p.nome}</td><td>{p.referencia}</td>
              <td>{p.fornecedor}</td>
              <td style={{ color: p.quantidade <= 3 ? 'red' : 'black', fontWeight: p.quantidade <= 3 ? 'bold' : 'normal' }}>{p.quantidade}</td>
              <td>{p.valorUnitario?.toLocaleString('pt-BR', {style: 'currency', currency:'BRL'})}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
