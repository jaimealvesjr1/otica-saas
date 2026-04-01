import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, doc, updateDoc } from 'firebase/firestore';

export default function Estoque() {
  const [produtos, setProdutos] = useState<any[]>([]);
  const [fornecedores, setFornecedores] = useState<any[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  
  // Campos
  const [nome, setNome] = useState('');
  const [referencia, setReferencia] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [valorUnitario, setValorUnitario] = useState('');
  const [dataEntrada, setDataEntrada] = useState('');
  const [fornecedorBusca, setFornecedorBusca] = useState('');

  // Edição
  const [modalAberto, setModalAberto] = useState(false);
  const [produtoAtual, setProdutoAtual] = useState<any>(null);
  const [modoEdicao, setModoEdicao] = useState(false);

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
    setMostrarForm(false);
    setNome(''); setReferencia(''); setQuantidade(''); setValorUnitario(''); setDataEntrada(''); setFornecedorBusca('');
    carregarDados();
  };

  const salvarEdicao = async () => {
    try {
      await updateDoc(doc(db, 'estoque', produtoAtual.id), {
        ...produtoAtual,
        quantidade: parseInt(produtoAtual.quantidade),
        valorUnitario: parseFloat(produtoAtual.valorUnitario.toString().replace(',', '.'))
      });
      alert('Produto atualizado!');
      setModoEdicao(false);
      carregarDados();
    } catch (error) { alert('Erro ao atualizar.'); }
  };

  return (
    <div>
      <style>{`@media print { .no-print { display: none !important; } .print-only { display: block !important; } }`}</style>
      
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>📦 Controle de Estoque</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => window.print()} style={{ background: '#17a2b8', color: 'white' }}>🖨️ Gerar Relatório</button>
          <button onClick={() => setMostrarForm(!mostrarForm)} style={{ background: mostrarForm ? '#6c757d' : '#28a745', color: 'white' }}>
            {mostrarForm ? 'Cancelar / Fechar' : '+ Nova Entrada'}
          </button>
        </div>
      </div>

      {/* Relatório de Impressão Cabecalho */}
      <div className="print-only" style={{ display: 'none', textAlign: 'center', marginBottom: '20px' }}>
        <h2>Relatório de Estoque Atual - Ótica Milenium</h2>
        <hr/>
      </div>

      {mostrarForm && (
        <div className="card-formulario no-print" style={{ marginBottom: '20px' }}>
          <form onSubmit={cadastrarProduto} style={{ display: 'grid', gap: '15px', gridTemplateColumns: '1fr 1fr' }}>
            <div><label>Nome do Produto / Lente</label><input type="text" value={nome} onChange={e => setNome(e.target.value)} required /></div>
            <div><label>Referência / Código</label><input type="text" value={referencia} onChange={e => setReferencia(e.target.value)} required /></div>
            <div>
              <label>Fornecedor</label>
              <input type="text" list="lista-fornecedores" value={fornecedorBusca} onChange={e => setFornecedorBusca(e.target.value)} required />
              <datalist id="lista-fornecedores">{fornecedores.map(f => <option key={f.id} value={f.nome} />)}</datalist>
            </div>
            <div><label>Data de Entrada</label><input type="date" value={dataEntrada} onChange={e => setDataEntrada(e.target.value)} required /></div>
            <div><label>Quantidade (Unidades)</label><input type="number" value={quantidade} onChange={e => setQuantidade(e.target.value)} required /></div>
            <div><label>Valor de Venda (R$)</label><input type="text" value={valorUnitario} onChange={e => setValorUnitario(e.target.value)} required /></div>
            <button type="submit" style={{ gridColumn: 'span 2', background: '#007bff' }}>Salvar no Estoque</button>
          </form>
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr style={{ backgroundColor: '#334155', color: 'white' }}><th>Data Entrada</th><th>Produto</th><th>Ref</th><th>Fornecedor</th><th>Qtd</th><th>Valor (R$)</th><th className="no-print">Ação</th></tr></thead>
        <tbody>
          {produtos.map(p => (
            <tr key={p.id}>
              <td>{p.dataEntrada?.split('-').reverse().join('/')}</td><td>{p.nome}</td><td>{p.referencia}</td>
              <td>{p.fornecedor}</td>
              <td style={{ color: p.quantidade <= 3 ? 'red' : 'black', fontWeight: p.quantidade <= 3 ? 'bold' : 'normal' }}>{p.quantidade}</td>
              <td>{p.valorUnitario?.toLocaleString('pt-BR', {style: 'currency', currency:'BRL'})}</td>
              <td className="no-print"><button onClick={() => { setProdutoAtual(p); setModoEdicao(false); setModalAberto(true); }} style={{ background: '#ffc107', color: 'white', padding: '5px 10px', fontSize: '12px' }}>Editar</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* MODAL DE EDIÇÃO DE ESTOQUE */}
      {modalAberto && produtoAtual && (
        <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card-formulario" style={{ width: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0 }}>Ref: {produtoAtual.referencia}</h3>
              <button onClick={() => setModoEdicao(!modoEdicao)} style={{ background: modoEdicao ? '#6c757d' : '#ffc107', color: 'white' }}>
                {modoEdicao ? 'Cancelar Edição' : '✏️ Editar'}
              </button>
            </div>
            
            {modoEdicao ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ gridColumn: 'span 2' }}><label>Nome do Produto</label><input value={produtoAtual.nome} onChange={e => setProdutoAtual({...produtoAtual, nome: e.target.value})} /></div>
                <div><label>Referência / Código</label><input value={produtoAtual.referencia} onChange={e => setProdutoAtual({...produtoAtual, referencia: e.target.value})} /></div>
                <div><label>Data de Entrada</label><input type="date" value={produtoAtual.dataEntrada} onChange={e => setProdutoAtual({...produtoAtual, dataEntrada: e.target.value})} /></div>
                <div><label>Quantidade</label><input type="number" value={produtoAtual.quantidade} onChange={e => setProdutoAtual({...produtoAtual, quantidade: e.target.value})} /></div>
                <div><label>Valor (R$)</label><input value={produtoAtual.valorUnitario} onChange={e => setProdutoAtual({...produtoAtual, valorUnitario: e.target.value})} /></div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Fornecedor</label>
                  <input type="text" list="lista-fornecedores-edit" value={produtoAtual.fornecedor} onChange={e => setProdutoAtual({...produtoAtual, fornecedor: e.target.value})} />
                  <datalist id="lista-fornecedores-edit">{fornecedores.map(f => <option key={f.id} value={f.nome} />)}</datalist>
                </div>
                <button onClick={salvarEdicao} style={{ gridColumn: 'span 2', background: '#28a745', marginTop: '10px', color: 'white' }}>💾 Confirmar Alterações</button>
              </div>
            ) : (
              <div>
                <p><strong>Produto:</strong> {produtoAtual.nome}</p>
                <p><strong>Quantidade Atual:</strong> {produtoAtual.quantidade} unidades</p>
                <p><strong>Valor:</strong> {produtoAtual.valorUnitario?.toLocaleString('pt-BR', {style: 'currency', currency:'BRL'})}</p>
                <p><strong>Fornecedor:</strong> {produtoAtual.fornecedor}</p>
              </div>
            )}
            <button onClick={() => setModalAberto(false)} style={{ background: 'red', color: 'white', width: '100%', marginTop: '15px' }}>Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
}
