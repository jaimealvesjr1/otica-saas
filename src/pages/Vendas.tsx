import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { collection, addDoc, getDocs, doc, updateDoc, increment, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { obterProximoCodigo, formatarCodigo } from '../utils/geradores';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth'; // NOVO: Segurança

interface ItemCarrinho {
  produtoId: string; nome: string; referencia: string; quantidade: number; valorUnitario: number; subtotal: number;
}

export default function Vendas() {
  const { user } = useAuth();
  const cargo = user?.cargo?.toLowerCase() || '';
  const isGerenteOuAdmin = cargo === 'admin' || cargo === 'gerente';

  const [clientes, setClientes] = useState<any[]>([]);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [vendas, setVendas] = useState<any[]>([]);
  const [valorUnitarioManual, setValorUnitarioManual] = useState('');

  const [mostrarForm, setMostrarForm] = useState(false);
  const [etapa, setEtapa] = useState(1);
  const [modalAberto, setModalAberto] = useState(false);
  const [vendaAtual, setVendaAtual] = useState<any>(null);
  const [numeroTalao, setNumeroTalao] = useState('');
  const [clienteBusca, setClienteBusca] = useState('');
  const [clienteSelecionado, setClienteSelecionado] = useState<any>(null);
  const [produtoBusca, setProdutoBusca] = useState('');
  const [qtdProduto, setQtdProduto] = useState('1');
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [formaPagamento, setFormaPagamento] = useState('A Vista');
  const [valorEntrada, setValorEntrada] = useState('');
  const [periodicidade, setPeriodicidade] = useState('Mensal');
  const [qtdParcelas, setQtdParcelas] = useState('1');
  const [primeiroVencimento, setPrimeiroVencimento] = useState('');

  // Segurança de Exclusão
  const [modalSeguranca, setModalSeguranca] = useState(false);
  const [vendaExcluir, setVendaExcluir] = useState<any>(null);
  const [senhaConfirmacao, setSenhaConfirmacao] = useState('');

  const valorTotalVenda = carrinho.reduce((acc, item) => acc + item.subtotal, 0);

  const carregarDados = async () => {
    const cliSnap = await getDocs(collection(db, 'clientes')); setClientes(cliSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    const prodSnap = await getDocs(collection(db, 'estoque')); setProdutos(prodSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    const vendSnap = await getDocs(collection(db, 'vendas')); setVendas(vendSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)).sort((a: any, b: any) => b.numeroTalao - a.numeroTalao));
  };

  useEffect(() => { carregarDados(); }, []);

  useEffect(() => {
    const prod = produtos.find(p => p.nome === produtoBusca);
    setValorUnitarioManual(prod ? prod.valorUnitario.toString() : '');
  }, [produtoBusca, produtos]);

  const iniciarNovaVenda = async () => {
    const proximo = await obterProximoCodigo('vendas'); setNumeroTalao(proximo.toString()); setMostrarForm(true);
  };

  const avancarParaCarrinho = (e: React.FormEvent) => {
    e.preventDefault();
    const clienteEncontrado = clientes.find(c => c.nome === clienteBusca);
    if (!clienteEncontrado) return alert("Selecione um cliente válido.");
    setClienteSelecionado(clienteEncontrado); setEtapa(2);
  };

  const adicionarAoCarrinho = () => {
    const prodEncontrado = produtos.find(p => p.nome === produtoBusca);
    if (!prodEncontrado) return alert("Selecione um produto válido.");
    const valorFinal = parseFloat(valorUnitarioManual.replace(',', '.'));
    if (isNaN(valorFinal)) return alert("Preço inválido.");
    const qtdNum = parseInt(qtdProduto);
    if (prodEncontrado.quantidade < qtdNum) return alert(`Estoque insuficiente! Restam ${prodEncontrado.quantidade}.`);

    setCarrinho([...carrinho, { produtoId: prodEncontrado.id, nome: prodEncontrado.nome, referencia: prodEncontrado.referencia, quantidade: qtdNum, valorUnitario: valorFinal, subtotal: valorFinal * qtdNum }]);
    setProdutoBusca(''); setQtdProduto('1'); setValorUnitarioManual('');
  };

  const removerItem = (index: number) => { const novo = [...carrinho]; novo.splice(index, 1); setCarrinho(novo); };

  const finalizarVenda = async (e: React.FormEvent) => {
    e.preventDefault();
    if (carrinho.length === 0) return alert("Carrinho vazio!"); if (!numeroTalao) return alert("Preencha o Talão!");
    const talaoFinal = parseInt(numeroTalao);
    if (vendas.find(v => v.numeroTalao === talaoFinal)) return alert(`⛔ O Talão ${talaoFinal} já existe!`);

    try {
      let dadosCarne = null;
      if (formaPagamento === 'Carnê') {
        const entradaNum = valorEntrada ? parseFloat(valorEntrada.replace(',', '.')) : 0;
        const valorRestante = valorTotalVenda - entradaNum;
        dadosCarne = { entrada: entradaNum, restante: valorRestante, quitado: valorRestante <= 0, historicoPagamentos: [] };
      }

      await addDoc(collection(db, 'vendas'), {
        numeroTalao: talaoFinal, dataVenda: new Date().toISOString().split('T')[0], clienteId: clienteSelecionado.id, clienteNome: clienteSelecionado.nome, itens: carrinho, valorTotal: valorTotalVenda, formaPagamento, vendedor: user?.nome, carne: dadosCarne
      });

      for (const item of carrinho) await updateDoc(doc(db, 'estoque', item.produtoId), { quantidade: increment(-item.quantidade) });

      alert('Venda finalizada!'); setMostrarForm(false); setEtapa(1); setClienteBusca(''); setClienteSelecionado(null); setCarrinho([]); setValorEntrada(''); carregarDados();
    } catch (error) { alert('Erro ao finalizar venda.'); }
  };

  // 🚀 LÓGICA DE EXCLUSÃO SEGURA
  const confirmarExclusao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !user?.email) return;
    try {
      const credencial = EmailAuthProvider.credential(user.email, senhaConfirmacao);
      await reauthenticateWithCredential(auth.currentUser, credencial); // Valida a senha
      
      // Devolve os itens ao estoque
      for (const item of vendaExcluir.itens) {
        await updateDoc(doc(db, 'estoque', item.produtoId), { quantidade: increment(item.quantidade) });
      }
      // Apaga a venda
      await deleteDoc(doc(db, 'vendas', vendaExcluir.id));
      
      alert('Venda excluída e produtos devolvidos ao estoque!');
      setModalSeguranca(false); setSenhaConfirmacao(''); carregarDados();
    } catch (error) {
      alert('⛔ Senha incorreta! Exclusão não autorizada.');
    }
  };

  const cancelarVenda = () => { setMostrarForm(false); setEtapa(1); setClienteBusca(''); setCarrinho([]); };

  return (
    <div>
      <style>{`@media print { body * { visibility: hidden; } #recibo-venda, #recibo-venda * { visibility: visible; } #recibo-venda { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; } .no-print { display: none !important; } }`}</style>
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>💰 Operação de Vendas (PDV)</h2>
        {!mostrarForm && <button onClick={iniciarNovaVenda} style={{ background: '#28a745', color: 'white' }}>+ Nova Venda</button>}
      </div>

      {/* FORMULÁRIOS DE VENDA (Mantidos iguais...) */}
      {mostrarForm && (
        <div className="card-formulario no-print" style={{ marginBottom: '20px', borderTop: '4px solid #007bff' }}>
          {etapa === 1 && (
            <form onSubmit={avancarParaCarrinho}>
              <h3>Etapa 1: Selecionar Cliente</h3>
              <input type="text" list="clientes-list" value={clienteBusca} onChange={e => setClienteBusca(e.target.value)} required placeholder="Digite o nome..." style={{ marginBottom: '15px' }} />
              <datalist id="clientes-list">{clientes.map(c => <option key={c.id} value={c.nome} />)}</datalist>
              <div style={{ display: 'flex', gap: '10px' }}><button type="submit" style={{ background: '#007bff', color: 'white', flex: 1 }}>Avançar ➔</button><button type="button" onClick={cancelarVenda} style={{ background: '#dc3545', color: 'white' }}>Cancelar</button></div>
            </form>
          )}
          {etapa === 2 && (
            <div>
              <h3>Etapa 2: Produtos <span style={{fontSize:'14px', color:'#666'}}>({clienteSelecionado?.nome})</span></h3>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', background: '#f8f9fa', padding: '15px', borderRadius: '5px', marginBottom: '15px' }}>
                <div style={{ flex: 2 }}><label style={{ fontWeight: 'bold', fontSize: '12px' }}>Produto / Lente</label><input type="text" list="produtos-list" value={produtoBusca} onChange={e => setProdutoBusca(e.target.value)} placeholder="Buscar produto..." /><datalist id="produtos-list">{produtos.map(p => <option key={p.id} value={p.nome} />)}</datalist></div>
                <div style={{ flex: 1 }}><label style={{ fontWeight: 'bold', fontSize: '12px', color: '#007bff' }}>Preço (R$)</label><input type="text" value={valorUnitarioManual} onChange={e => setValorUnitarioManual(e.target.value)} style={{ border: '2px solid #007bff' }} /></div>
                <div style={{ flex: 1 }}><label style={{ fontWeight: 'bold', fontSize: '12px' }}>Qtd</label><input type="number" min="1" value={qtdProduto} onChange={e => setQtdProduto(e.target.value)} /></div>
                <button type="button" onClick={adicionarAoCarrinho} style={{ background: '#28a745', color: 'white', height: '40px' }}>+ Adicionar</button>
              </div>
              {carrinho.length > 0 && (
                <table style={{ width: '100%', marginBottom: '15px' }}>
                  <thead><tr style={{ background: '#eee' }}><th>Ref</th><th>Produto</th><th>Qtd</th><th>Subtotal</th><th>X</th></tr></thead>
                  <tbody>{carrinho.map((item, i) => (<tr key={i}><td>{item.referencia}</td><td>{item.nome}</td><td>{item.quantidade}</td><td>{item.subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td><td><button onClick={() => removerItem(i)} style={{ background: 'red', color: 'white', padding: '5px 8px', fontSize: '10px' }}>X</button></td></tr>))}</tbody>
                </table>
              )}
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}><button onClick={() => setEtapa(1)} style={{ background: '#6c757d', color: 'white' }}>⬅ Voltar</button><button onClick={() => setEtapa(3)} disabled={carrinho.length === 0} style={{ background: '#007bff', color: 'white', flex: 1, opacity: carrinho.length === 0 ? 0.5 : 1 }}>Ir para Pagamento ({valorTotalVenda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}) ➔</button></div>
            </div>
          )}
          {etapa === 3 && (
            <form onSubmit={finalizarVenda}>
              <h3>Etapa 3: Pagamento</h3>
              <div style={{ background: '#e2e8f0', padding: '15px', borderRadius: '5px', marginBottom: '15px', display: 'flex', gap: '15px', alignItems: 'center' }}><label style={{ fontWeight: 'bold', fontSize: '14px', color: '#1e293b' }}>Nº do Talão Físico:</label><input type="number" value={numeroTalao} onChange={e => setNumeroTalao(e.target.value)} required style={{ fontSize: '18px', fontWeight: 'bold', width: '150px', textAlign: 'center', border: '2px solid #007bff' }} /><span style={{ fontSize: '12px', color: '#64748b' }}>Edite se não for sequencial.</span></div>
              <div style={{ background: '#d4edda', padding: '15px', borderRadius: '5px', marginBottom: '15px', textAlign: 'center' }}><strong style={{ fontSize: '18px', color: '#155724' }}>Total: {valorTotalVenda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></div>
              <div><label style={{ fontWeight: 'bold', fontSize: '13px' }}>Forma</label><select value={formaPagamento} onChange={e => setFormaPagamento(e.target.value)} style={{ marginBottom: '15px' }}><option value="A Vista">A Vista (Dinheiro/PIX)</option><option value="Cartão">Cartão</option><option value="Carnê">Carnê (Parcelado)</option></select></div>
              {formaPagamento === 'Carnê' && (
                <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: '1fr 1fr', backgroundColor: '#fff3cd', padding: '15px', borderRadius: '5px', marginBottom: '15px' }}><div><label>Entrada (R$)</label><input type="text" value={valorEntrada} onChange={e => setValorEntrada(e.target.value)} /></div><div><label>Frequência</label><select value={periodicidade} onChange={e => setPeriodicidade(e.target.value)}><option>Mensal</option><option>Quinzenal</option></select></div><div><label>Parcelas</label><input type="number" min="1" value={qtdParcelas} onChange={e => setQtdParcelas(e.target.value)} required /></div><div><label>1º Venc.</label><input type="date" value={primeiroVencimento} onChange={e => setPrimeiroVencimento(e.target.value)} required /></div></div>
              )}
              <div style={{ display: 'flex', gap: '10px' }}><button type="button" onClick={() => setEtapa(2)} style={{ background: '#6c757d', color: 'white' }}>⬅ Voltar</button><button type="submit" style={{ background: '#28a745', color: 'white', flex: 1 }}>✅ Confirmar</button></div>
            </form>
          )}
        </div>
      )}

      <div className="no-print">
        <h3>Histórico de Vendas</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: '#2c3e50', color: 'white' }}><th style={{padding:'10px'}}>Talão</th><th>Data</th><th>Cliente</th><th>Total</th><th style={{textAlign:'center'}}>Ações</th></tr></thead>
          <tbody>
            {vendas.map(v => (
              <tr key={v.id} style={{borderBottom: '1px solid #e2e8f0'}}>
                <td style={{padding:'10px'}}>{formatarCodigo(v.numeroTalao)}</td><td>{v.dataVenda.split('-').reverse().join('/')}</td><td>{v.clienteNome}</td><td style={{ fontWeight: 'bold' }}>{v.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                <td style={{textAlign:'center'}}>
                  <button onClick={() => { setVendaAtual(v); setModalAberto(true); }} style={{ background: '#17a2b8', color: 'white', padding: '5px 10px', fontSize: '12px', marginRight: '5px' }}>Ver</button>
                  {/* Botão de Excluir (Só Admin/Gerente) */}
                  {isGerenteOuAdmin && (
                    <button onClick={() => { setVendaExcluir(v); setModalSeguranca(true); }} style={{ background: '#ef4444', color: 'white', padding: '5px 10px', fontSize: '12px' }}>🗑️</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL DE RECIBO MANTIDO... */}
      {modalAberto && vendaAtual && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, paddingTop: '20px' }}>
          <div id="recibo-venda" className="card-formulario" style={{ width: '600px', maxHeight: '90vh', overflowY: 'auto', background: 'white' }}>
            <div style={{ textAlign: 'center', borderBottom: '2px dashed #ccc', paddingBottom: '15px', marginBottom: '15px' }}><h2>RECIBO DE VENDA</h2><p><strong>Talão:</strong> {formatarCodigo(vendaAtual.numeroTalao)} | <strong>Data:</strong> {vendaAtual.dataVenda.split('-').reverse().join('/')}</p><p><strong>Cliente:</strong> {vendaAtual.clienteNome}</p><p><strong>Vendedor:</strong> {vendaAtual.vendedor}</p></div>
            <table style={{ width: '100%', marginBottom: '20px', fontSize: '14px' }}><thead><tr style={{ background: '#f8f9fa' }}><th>Qtd</th><th>Descrição</th><th>Subtotal</th></tr></thead><tbody>{vendaAtual.itens?.map((item: any, i: number) => (<tr key={i}><td style={{ textAlign: 'center' }}>{item.quantidade}x</td><td>{item.nome}</td><td>{item.subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td></tr>))}</tbody></table>
            <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '5px', marginBottom: '20px' }}><h4 style={{ margin: '0 0 10px 0' }}>Resumo</h4><p><strong>Forma:</strong> {vendaAtual.formaPagamento}</p><p style={{ fontSize: '18px', fontWeight: 'bold' }}>Total: <span style={{ color: '#28a745' }}>{vendaAtual.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></p></div>
            <div className="no-print" style={{ display: 'flex', gap: '10px' }}><button onClick={() => window.print()} style={{ background: '#17a2b8', color: 'white', flex: 1 }}>🖨️ Imprimir</button><button onClick={() => setModalAberto(false)} style={{ background: 'red', color: 'white', flex: 1 }}>Fechar</button></div>
          </div>
        </div>
      )}

      {/* 🚀 MODAL DE SEGURANÇA PARA EXCLUSÃO */}
      {modalSeguranca && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div className="card-formulario" style={{ width: '400px', textAlign: 'center' }}>
            <h3 style={{ color: '#ef4444', marginTop: 0 }}>⚠️ Exclusão de Segurança</h3>
            <p>Você está prestes a excluir o Talão <strong>{formatarCodigo(vendaExcluir?.numeroTalao)}</strong>.</p>
            <p style={{ fontSize: '12px', color: '#64748b' }}>Os produtos vendidos serão devolvidos ao estoque.</p>
            <form onSubmit={confirmarExclusao}>
              <input type="password" placeholder="Digite sua senha para confirmar" required value={senhaConfirmacao} onChange={e => setSenhaConfirmacao(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '15px', textAlign: 'center', border: '2px solid #ef4444' }} />
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" style={{ background: '#ef4444', color: 'white', flex: 1 }}>Confirmar Exclusão</button>
                <button type="button" onClick={() => { setModalSeguranca(false); setSenhaConfirmacao(''); }} style={{ background: '#64748b', color: 'white', flex: 1 }}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
