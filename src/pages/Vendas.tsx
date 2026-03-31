import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, doc, updateDoc, increment } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { obterProximoCodigo, formatarCodigo } from '../utils/geradores';

interface ItemCarrinho {
  produtoId: string;
  nome: string;
  referencia: string;
  quantidade: number;
  valorUnitario: number;
  subtotal: number;
}

export default function Vendas() {
  const { user } = useAuth();
  const [clientes, setClientes] = useState<any[]>([]);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [vendas, setVendas] = useState<any[]>([]);

  // Controle de Telas
  const [mostrarForm, setMostrarForm] = useState(false);
  const [etapa, setEtapa] = useState(1);
  const [modalAberto, setModalAberto] = useState(false);
  const [vendaAtual, setVendaAtual] = useState<any>(null);

  // Etapa 1: Cliente
  const [clienteBusca, setClienteBusca] = useState('');
  const [clienteSelecionado, setClienteSelecionado] = useState<any>(null);

  // Etapa 2: Carrinho
  const [produtoBusca, setProdutoBusca] = useState('');
  const [qtdProduto, setQtdProduto] = useState('1');
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);

  // Etapa 3: Pagamento
  const [formaPagamento, setFormaPagamento] = useState('A Vista');
  const [valorEntrada, setValorEntrada] = useState('');
  const [periodicidade, setPeriodicidade] = useState('Mensal');
  const [qtdParcelas, setQtdParcelas] = useState('1');
  const [primeiroVencimento, setPrimeiroVencimento] = useState('');

  // Cálculo Automático do Total
  const valorTotalVenda = carrinho.reduce((acc, item) => acc + item.subtotal, 0);

  const carregarDados = async () => {
    const cliSnap = await getDocs(collection(db, 'clientes'));
    setClientes(cliSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    const prodSnap = await getDocs(collection(db, 'estoque'));
    setProdutos(prodSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    const vendSnap = await getDocs(collection(db, 'vendas'));
    setVendas(vendSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)).sort((a: any, b: any) => b.numeroTalao - a.numeroTalao));
  };

  useEffect(() => { carregarDados(); }, []);

  // --- FUNÇÕES DO CARRINHO ---
  const avancarParaCarrinho = (e: React.FormEvent) => {
    e.preventDefault();
    const clienteEncontrado = clientes.find(c => c.nome === clienteBusca);
    if (!clienteEncontrado) return alert("Por favor, selecione um cliente válido da lista.");
    setClienteSelecionado(clienteEncontrado);
    setEtapa(2);
  };

  const adicionarAoCarrinho = () => {
    const prodEncontrado = produtos.find(p => p.nome === produtoBusca);
    if (!prodEncontrado) return alert("Selecione um produto válido da lista.");
    
    const qtdNum = parseInt(qtdProduto);
    if (prodEncontrado.quantidade < qtdNum) return alert(`Estoque insuficiente! Restam apenas ${prodEncontrado.quantidade} unidades.`);

    const novoItem: ItemCarrinho = {
      produtoId: prodEncontrado.id,
      nome: prodEncontrado.nome,
      referencia: prodEncontrado.referencia,
      quantidade: qtdNum,
      valorUnitario: prodEncontrado.valorUnitario,
      subtotal: prodEncontrado.valorUnitario * qtdNum
    };

    setCarrinho([...carrinho, novoItem]);
    setProdutoBusca('');
    setQtdProduto('1');
  };

  const removerItem = (index: number) => {
    const novoCarrinho = [...carrinho];
    novoCarrinho.splice(index, 1);
    setCarrinho(novoCarrinho);
  };

  // --- FINALIZAR VENDA ---
  const finalizarVenda = async (e: React.FormEvent) => {
    e.preventDefault();
    if (carrinho.length === 0) return alert("O carrinho está vazio!");

    try {
      const proximoTalao = await obterProximoCodigo('vendas');
      let dadosCarne = null;

      if (formaPagamento === 'Carnê') {
        const entradaNum = valorEntrada ? parseFloat(valorEntrada.replace(',', '.')) : 0;
        const valorRestante = valorTotalVenda - entradaNum;
        dadosCarne = { entrada: entradaNum, restante: valorRestante, quitado: valorRestante <= 0, historicoPagamentos: [] };
      }

      // 1. Salva a Venda no Banco
      await addDoc(collection(db, 'vendas'), {
        numeroTalao: proximoTalao,
        dataVenda: new Date().toISOString().split('T')[0],
        clienteId: clienteSelecionado.id,
        clienteNome: clienteSelecionado.nome,
        itens: carrinho, // Salva todos os produtos comprados
        valorTotal: valorTotalVenda,
        formaPagamento,
        vendedor: user?.nome,
        carne: dadosCarne
      });

      // 2. Dá Baixa no Estoque de TODOS os itens do carrinho
      for (const item of carrinho) {
        await updateDoc(doc(db, 'estoque', item.produtoId), { quantidade: increment(-item.quantidade) });
      }

      alert('Venda finalizada com sucesso!');
      
      // Resetar tudo
      setMostrarForm(false);
      setEtapa(1);
      setClienteBusca('');
      setClienteSelecionado(null);
      setCarrinho([]);
      setValorEntrada('');
      carregarDados();
    } catch (error) {
      alert('Erro ao finalizar venda.');
    }
  };

  const cancelarVenda = () => {
    setMostrarForm(false); setEtapa(1); setClienteBusca(''); setCarrinho([]);
  };

  return (
    <div>
      {/* Esconde os botões e títulos principais na hora da impressão */}
      <style>{`@media print { .no-print { display: none !important; } .print-only { display: block !important; } }`}</style>

      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>💰 Operação de Vendas (PDV)</h2>
        {!mostrarForm && <button onClick={() => setMostrarForm(true)} style={{ background: '#28a745', color: 'white' }}>+ Nova Venda</button>}
      </div>

      {/* --- MÁQUINA DE ESTADOS DO FORMULÁRIO (WIZARD) --- */}
      {mostrarForm && (
        <div className="card-formulario no-print" style={{ marginBottom: '20px', borderTop: '4px solid #007bff' }}>
          
          {/* ETAPA 1: CLIENTE */}
          {etapa === 1 && (
            <form onSubmit={avancarParaCarrinho}>
              <h3>Etapa 1: Selecionar Cliente</h3>
              <label style={{ fontWeight: 'bold', fontSize: '13px' }}>Buscar Cliente por Nome</label>
              <input type="text" list="clientes-list" value={clienteBusca} onChange={e => setClienteBusca(e.target.value)} required placeholder="Digite o nome..." style={{ marginBottom: '15px' }} />
              <datalist id="clientes-list">{clientes.map(c => <option key={c.id} value={c.nome} />)}</datalist>
              
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" style={{ background: '#007bff', flex: 1 }}>Avançar para Carrinho ➔</button>
                <button type="button" onClick={cancelarVenda} style={{ background: '#dc3545' }}>Cancelar</button>
              </div>
            </form>
          )}

          {/* ETAPA 2: CARRINHO DE PRODUTOS */}
          {etapa === 2 && (
            <div>
              <h3>Etapa 2: Adicionar Produtos <span style={{fontSize:'14px', color:'#666'}}>(Cliente: {clienteSelecionado?.nome})</span></h3>
              
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', background: '#f8f9fa', padding: '15px', borderRadius: '5px', marginBottom: '15px' }}>
                <div style={{ flex: 2 }}>
                  <label style={{ fontWeight: 'bold', fontSize: '12px' }}>Produto / Lente</label>
                  <input type="text" list="produtos-list" value={produtoBusca} onChange={e => setProdutoBusca(e.target.value)} placeholder="Buscar produto..." />
                  <datalist id="produtos-list">{produtos.map(p => <option key={p.id} value={p.nome} />)}</datalist>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontWeight: 'bold', fontSize: '12px' }}>Qtd</label>
                  <input type="number" min="1" value={qtdProduto} onChange={e => setQtdProduto(e.target.value)} />
                </div>
                <button type="button" onClick={adicionarAoCarrinho} style={{ background: '#28a745', height: '40px' }}>+ Adicionar</button>
              </div>

              {carrinho.length > 0 && (
                <table style={{ width: '100%', marginBottom: '15px' }}>
                  <thead><tr style={{ background: '#eee' }}><th>Ref</th><th>Produto</th><th>Qtd</th><th>Subtotal</th><th>X</th></tr></thead>
                  <tbody>
                    {carrinho.map((item, i) => (
                      <tr key={i}>
                        <td>{item.referencia}</td><td>{item.nome}</td><td>{item.quantidade}</td>
                        <td>{item.subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                        <td><button onClick={() => removerItem(i)} style={{ background: 'red', padding: '5px 8px', fontSize: '10px' }}>X</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button onClick={() => setEtapa(1)} style={{ background: '#6c757d' }}>⬅ Voltar</button>
                <button onClick={() => setEtapa(3)} disabled={carrinho.length === 0} style={{ background: '#007bff', flex: 1, opacity: carrinho.length === 0 ? 0.5 : 1 }}>
                  Ir para Pagamento ({valorTotalVenda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}) ➔
                </button>
              </div>
            </div>
          )}

          {/* ETAPA 3: PAGAMENTO */}
          {etapa === 3 && (
            <form onSubmit={finalizarVenda}>
              <h3>Etapa 3: Pagamento</h3>
              <div style={{ background: '#d4edda', padding: '15px', borderRadius: '5px', marginBottom: '15px', textAlign: 'center' }}>
                <strong style={{ fontSize: '18px', color: '#155724' }}>Total a Pagar: {valorTotalVenda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
              </div>

              <div>
                <label style={{ fontWeight: 'bold', fontSize: '13px' }}>Forma de Pagamento</label>
                <select value={formaPagamento} onChange={e => setFormaPagamento(e.target.value)} style={{ marginBottom: '15px' }}>
                  <option value="A Vista">A Vista (Dinheiro/PIX)</option>
                  <option value="Cartão">Cartão de Crédito/Débito</option>
                  <option value="Carnê">Carnê da Ótica (Parcelado)</option>
                </select>
              </div>

              {formaPagamento === 'Carnê' && (
                <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: '1fr 1fr', backgroundColor: '#fff3cd', padding: '15px', borderRadius: '5px', marginBottom: '15px' }}>
                  <div><label>Valor de Entrada (R$)</label><input type="text" value={valorEntrada} onChange={e => setValorEntrada(e.target.value)} /></div>
                  <div><label>Frequência</label><select value={periodicidade} onChange={e => setPeriodicidade(e.target.value)}><option>Mensal</option><option>Quinzenal</option></select></div>
                  <div><label>Nº Parcelas</label><input type="number" min="1" value={qtdParcelas} onChange={e => setQtdParcelas(e.target.value)} required /></div>
                  <div><label>1º Vencimento</label><input type="date" value={primeiroVencimento} onChange={e => setPrimeiroVencimento(e.target.value)} required /></div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" onClick={() => setEtapa(2)} style={{ background: '#6c757d' }}>⬅ Voltar</button>
                <button type="submit" style={{ background: '#28a745', flex: 1 }}>✅ Confirmar e Salvar Venda</button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* --- LISTAGEM DE VENDAS --- */}
      <div className="no-print">
        <h3>Histórico de Vendas</h3>
        <table style={{ width: '100%' }}>
          <thead><tr style={{ background: '#2c3e50', color: 'white' }}><th>Talão</th><th>Data</th><th>Cliente</th><th>Pagamento</th><th>Total</th><th>Ação</th></tr></thead>
          <tbody>
            {vendas.map(v => (
              <tr key={v.id}>
                <td>{formatarCodigo(v.numeroTalao)}</td><td>{v.dataVenda.split('-').reverse().join('/')}</td>
                <td>{v.clienteNome}</td><td>{v.formaPagamento}</td>
                <td style={{ fontWeight: 'bold' }}>{v.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                <td><button onClick={() => { setVendaAtual(v); setModalAberto(true); }} style={{ background: '#17a2b8', padding: '5px 10px', fontSize: '12px', color: 'white'}}>Ver Detalhes</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* --- MODAL DE VISUALIZAÇÃO / IMPRESSÃO --- */}
      {modalAberto && vendaAtual && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card-formulario" style={{ width: '600px', maxHeight: '90vh', overflowY: 'auto', background: 'white' }}>
            
            {/* Cabeçalho do Recibo */}
            <div style={{ textAlign: 'center', borderBottom: '2px dashed #ccc', paddingBottom: '15px', marginBottom: '15px' }}>
              <h2>RECIBO DE VENDA</h2>
              <p><strong>Talão:</strong> {formatarCodigo(vendaAtual.numeroTalao)} | <strong>Data:</strong> {vendaAtual.dataVenda.split('-').reverse().join('/')}</p>
              <p><strong>Cliente:</strong> {vendaAtual.clienteNome}</p>
              <p><strong>Vendedor:</strong> {vendaAtual.vendedor}</p>
            </div>

            {/* Itens Comprados */}
            <h4>Produtos Adquiridos</h4>
            <table style={{ width: '100%', marginBottom: '20px', fontSize: '14px' }}>
              <thead><tr style={{ background: '#f8f9fa' }}><th>Qtd</th><th>Descrição</th><th>Subtotal</th></tr></thead>
              <tbody>
                {vendaAtual.itens?.map((item: any, i: number) => (
                  <tr key={i}><td style={{ textAlign: 'center' }}>{item.quantidade}x</td><td>{item.nome}</td><td>{item.subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td></tr>
                ))}
              </tbody>
            </table>

            {/* Histórico Financeiro */}
            <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '5px', marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 10px 0' }}>Resumo Financeiro</h4>
              <p><strong>Forma de Pagamento:</strong> {vendaAtual.formaPagamento}</p>
              <p style={{ fontSize: '18px', fontWeight: 'bold' }}>Total da Venda: <span style={{ color: '#28a745' }}>{vendaAtual.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></p>
              
              {vendaAtual.formaPagamento === 'Carnê' && (
                <div style={{ marginTop: '15px', borderTop: '1px solid #ddd', paddingTop: '10px' }}>
                  <p><strong>Entrada Paga:</strong> {vendaAtual.carne?.entrada.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                  <p style={{ color: vendaAtual.carne?.quitado ? '#28a745' : 'red', fontWeight: 'bold' }}>
                    <strong>{vendaAtual.carne?.quitado ? '🎉 CARNÊ QUITADO' : `Saldo Devedor: ${vendaAtual.carne?.restante.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}</strong>
                  </p>
                  
                  {/* Tabela de Pagamentos Parciais (Vem lá da tela Contas a Receber) */}
                  {vendaAtual.carne?.historicoPagamentos?.length > 0 && (
                    <div style={{ marginTop: '10px' }}>
                      <strong>Histórico de Baixas:</strong>
                      <ul style={{ paddingLeft: '20px', margin: '5px 0', fontSize: '13px' }}>
                        {vendaAtual.carne.historicoPagamentos.map((pag: any, i: number) => (
                          <li key={i}>{pag.data.split('-').reverse().join('/')} - Pago: <span style={{ color: 'green', fontWeight: 'bold' }}>{pag.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="no-print" style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => window.print()} style={{ background: '#17a2b8', flex: 1, color: 'white' }}>🖨️ Imprimir Recibo</button>
              <button onClick={() => setModalAberto(false)} style={{ background: 'red', color: 'white', flex: 1 }}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
