// src/pages/Estoque.tsx
import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { formatarCodigo } from '../utils/geradores';
import { useAuth } from '../contexts/AuthContext'; // NOVO: Para verificar quem é o usuário

export default function Estoque() {
  const { user } = useAuth(); // NOVO: Pega o usuário logado
  const cargo = user?.cargo?.toLowerCase() || '';
  const isGerenteOuAdmin = cargo === 'admin' || cargo === 'gerente'; // NOVO: Regra de permissão

  const [produtos, setProdutos] = useState<any[]>([]);
  const [fornecedores, setFornecedores] = useState<any[]>([]);
  const [vendas, setVendas] = useState<any[]>([]); 
  const [mostrarForm, setMostrarForm] = useState(false);
  
  // Campos
  const [referencia, setReferencia] = useState('');
  const [nome, setNome] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [valorUnitario, setValorUnitario] = useState('');
  const [dataEntrada, setDataEntrada] = useState('');
  const [fornecedorBusca, setFornecedorBusca] = useState('');

  // Identifica se a referência já existe no banco
  const [produtoExistente, setProdutoExistente] = useState<any>(null);

  // Edição e Info
  const [modalAberto, setModalAberto] = useState(false);
  const [produtoAtual, setProdutoAtual] = useState<any>(null);
  const [modoEdicao, setModoEdicao] = useState(false);

  const carregarDados = async () => {
    const prodSnap = await getDocs(collection(db, 'estoque'));
    setProdutos(prodSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    
    const fornSnap = await getDocs(collection(db, 'fornecedores'));
    setFornecedores(fornSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

    const vendSnap = await getDocs(collection(db, 'vendas'));
    setVendas(vendSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  useEffect(() => { carregarDados(); }, []);

  // Lógica: Ao digitar a referência, verifica se já existe
  useEffect(() => {
    if (referencia) {
      const encontrado = produtos.find(p => p.referencia.toLowerCase().trim() === referencia.toLowerCase().trim());
      if (encontrado) {
        setProdutoExistente(encontrado);
        setNome(encontrado.nome);
        setValorUnitario(encontrado.valorUnitario?.toString() || '');
      } else {
        setProdutoExistente(null);
        if (nome && produtoExistente) setNome(''); 
      }
    } else {
      setProdutoExistente(null);
    }
  }, [referencia, produtos]);

  const cadastrarProduto = async (e: React.FormEvent) => {
    e.preventDefault();

    // TRAVA 1: Verificar se Fornecedor Existe
    const fornecedorValido = fornecedores.find(f => f.nome.toLowerCase().trim() === fornecedorBusca.toLowerCase().trim());
    if (!fornecedorValido) {
      alert('Fornecedor inválido! Por favor, selecione um fornecedor que já esteja cadastrado na lista.');
      return;
    }

    const qtdNum = parseInt(quantidade);
    const valorNum = parseFloat(valorUnitario.replace(',', '.'));
    const registroHistorico = { data: dataEntrada, quantidade: qtdNum, fornecedor: fornecedorBusca, valorUnitario: valorNum };

    if (produtoExistente) {
      // É UMA NOVA ENTRADA DE UM PRODUTO QUE JÁ EXISTE
      const historicoAntigo = produtoExistente.historicoEntradas || [{
        data: produtoExistente.dataEntrada,
        quantidade: produtoExistente.quantidadeOriginal || produtoExistente.quantidade,
        fornecedor: produtoExistente.fornecedor,
        valorUnitario: produtoExistente.valorUnitario
      }];

      await updateDoc(doc(db, 'estoque', produtoExistente.id), {
        quantidade: produtoExistente.quantidade + qtdNum,
        valorUnitario: valorNum, 
        historicoEntradas: [...historicoAntigo, registroHistorico]
      });
      alert('Nova entrada adicionada ao produto existente com sucesso!');
    } else {
      // É UM PRODUTO TOTALMENTE NOVO
      await addDoc(collection(db, 'estoque'), {
        nome, referencia, quantidade: qtdNum, 
        valorUnitario: valorNum, 
        dataEntrada, fornecedor: fornecedorBusca,
        historicoEntradas: [registroHistorico]
      });
      alert('Novo produto cadastrado no estoque!');
    }
    
    setMostrarForm(false);
    setReferencia(''); setNome(''); setQuantidade(''); setValorUnitario(''); setDataEntrada(''); setFornecedorBusca('');
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

  // -------------------------------------------------------------------------
  // 🚀 MODO DE SEGURANÇA: DETECÇÃO E UNIFICAÇÃO DE PRODUTOS DUPLICADOS
  // -------------------------------------------------------------------------
  const verificarDuplicados = () => {
    const contagem: Record<string, number> = {};
    produtos.forEach(p => {
      if (p.referencia) contagem[p.referencia] = (contagem[p.referencia] || 0) + 1;
    });
    return Object.values(contagem).some(c => c > 1);
  };

  const unificarDuplicados = async () => {
    if (!window.confirm('Isto irá unificar todas as entradas com a mesma referência num único produto e organizará o histórico. Deseja continuar?')) return;

    const grupos: Record<string, any[]> = {};
    produtos.forEach(p => {
      if (!grupos[p.referencia]) grupos[p.referencia] = [];
      grupos[p.referencia].push(p);
    });

    for (const ref in grupos) {
      const itens = grupos[ref];
      if (itens.length > 1) {
        itens.sort((a,b) => new Date(a.dataEntrada).getTime() - new Date(b.dataEntrada).getTime());
        const principal = itens[0];
        const duplicados = itens.slice(1);

        let historico = principal.historicoEntradas || [{
          data: principal.dataEntrada, quantidade: principal.quantidade,
          fornecedor: principal.fornecedor, valorUnitario: principal.valorUnitario
        }];
        let totalQtd = principal.quantidade;

        for (const dup of duplicados) {
          totalQtd += dup.quantidade;
          historico.push({
            data: dup.dataEntrada, quantidade: dup.quantidade,
            fornecedor: dup.fornecedor, valorUnitario: dup.valorUnitario
          });
        }

        await updateDoc(doc(db, 'estoque', principal.id), { quantidade: totalQtd, historicoEntradas: historico });

        for (const dup of duplicados) {
          const vendasAfetadas = vendas.filter(v => v.itens?.some((i: any) => i.produtoId === dup.id));
          for (const v of vendasAfetadas) {
            const novosItens = v.itens.map((i: any) => i.produtoId === dup.id ? { ...i, produtoId: principal.id } : i);
            await updateDoc(doc(db, 'vendas', v.id), { itens: novosItens });
          }
          await deleteDoc(doc(db, 'estoque', dup.id));
        }
      }
    }
    alert('Limpeza e Unificação concluída com sucesso!');
    carregarDados();
  };

  const temDuplicados = verificarDuplicados();

  // -------------------------------------------------------------------------
  // 🚀 NOVO: FUNÇÃO PARA GERENTE APAGAR UMA ENTRADA ERRADA
  // -------------------------------------------------------------------------
  const apagarEntrada = async (indexOriginal: number, qtdRemover: number) => {
    if (!window.confirm(`⚠️ ATENÇÃO: Deseja realmente excluir esta entrada de ${qtdRemover} unidades?\nO estoque total deste produto será reduzido e esta ação não pode ser desfeita.`)) return;

    try {
      const historicoBase = produtoAtual.historicoEntradas || [{
        data: produtoAtual.dataEntrada, quantidade: produtoAtual.quantidadeOriginal || produtoAtual.quantidade,
        fornecedor: produtoAtual.fornecedor, valorUnitario: produtoAtual.valorUnitario
      }];

      // Remove a entrada específica pelo Index
      const novoHistorico = [...historicoBase];
      novoHistorico.splice(indexOriginal, 1);

      // Calcula a nova quantidade (evita ficar negativo se houver erro matemático)
      const novaQuantidade = produtoAtual.quantidade - qtdRemover;
      const quantidadeFinal = novaQuantidade < 0 ? 0 : novaQuantidade;

      // Atualiza no banco de dados
      await updateDoc(doc(db, 'estoque', produtoAtual.id), {
        historicoEntradas: novoHistorico,
        quantidade: quantidadeFinal
      });

      alert('Entrada removida e estoque recalculado com sucesso!');
      
      // Atualiza o estado local para atualizar a tela na mesma hora sem fechar o modal
      setProdutoAtual({ ...produtoAtual, historicoEntradas: novoHistorico, quantidade: quantidadeFinal });
      carregarDados();
    } catch (error) {
      alert('Erro ao excluir entrada.');
    }
  };

  // Função para montar o histórico misto do modal
  const gerarHistoricoMisto = () => {
    if (!produtoAtual) return [];
    
    // Entradas (Agora guarda o index original para podermos apagar depois)
    const historicoBase = produtoAtual.historicoEntradas || [{
      data: produtoAtual.dataEntrada, quantidade: produtoAtual.quantidadeOriginal || produtoAtual.quantidade,
      fornecedor: produtoAtual.fornecedor, valorUnitario: produtoAtual.valorUnitario
    }];

    const entradas = historicoBase.map((e: any, idx: number) => ({
      tipo: 'ENTRADA', data: e.data, qtd: e.quantidade,
      valor: e.valorUnitario, descricao: `Forn: ${e.fornecedor}`,
      indexOriginal: idx // NOVO: Guarda a posição real no banco de dados
    }));

    // Saídas
    const saidas = vendas.filter(v => v.itens?.some((i: any) => i.produtoId === produtoAtual.id)).map(v => {
      const itemVendido = v.itens.find((i: any) => i.produtoId === produtoAtual.id);
      return {
        tipo: 'SAÍDA', data: v.dataVenda, qtd: itemVendido.quantidade,
        valor: itemVendido.valorUnitario, descricao: `Talão: ${formatarCodigo(v.numeroTalao)}`
      };
    });

    return [...entradas, ...saidas].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  };

  return (
    <div>
      <style>{`@media print { .no-print { display: none !important; } .print-only { display: block !important; } }`}</style>
      
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>📦 Controle de Estoque</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          {temDuplicados && (
            <button onClick={unificarDuplicados} style={{ background: '#f59e0b', color: 'black', fontWeight: 'bold' }}>⚠️ Unificar Duplicados</button>
          )}
          <button onClick={() => window.print()} style={{ background: '#17a2b8', color: 'white' }}>🖨️ Gerar Relatório</button>
          <button onClick={() => setMostrarForm(!mostrarForm)} style={{ background: mostrarForm ? '#6c757d' : '#28a745', color: 'white' }}>
            {mostrarForm ? 'Cancelar / Fechar' : '+ Nova Entrada'}
          </button>
        </div>
      </div>

      <div className="print-only" style={{ display: 'none', textAlign: 'center', marginBottom: '20px' }}>
        <h2>Relatório de Estoque Atual - Ótica Milenium</h2><hr/>
      </div>

      {mostrarForm && (
        <div className="card-formulario no-print" style={{ marginBottom: '20px', borderTop: produtoExistente ? '4px solid #f59e0b' : '4px solid #007bff' }}>
          {produtoExistente && (
            <div style={{ background: '#fef3c7', padding: '10px', borderRadius: '5px', marginBottom: '15px', color: '#92400e', fontSize: '13px' }}>
              <strong>ℹ️ Produto já existente:</strong> Preencha apenas os dados desta nova remessa para somar ao estoque.
            </div>
          )}
          <form onSubmit={cadastrarProduto} style={{ display: 'grid', gap: '15px', gridTemplateColumns: '1fr 1fr' }}>
            <div><label style={{ fontWeight: 'bold' }}>Referência / Código *</label><input type="text" value={referencia} onChange={e => setReferencia(e.target.value)} required placeholder="Ex: RB3025" style={{ border: '2px solid #cbd5e1' }} /></div>
            <div><label>Nome do Produto / Lente</label><input type="text" value={nome} onChange={e => setNome(e.target.value)} required disabled={!!produtoExistente} style={{ background: produtoExistente ? '#e2e8f0' : 'white' }} /></div>
            <div>
              <label style={{ fontWeight: 'bold' }}>Fornecedor *</label>
              <input type="text" list="lista-fornecedores" value={fornecedorBusca} onChange={e => setFornecedorBusca(e.target.value)} required placeholder="Selecione da lista..." />
              <datalist id="lista-fornecedores">{fornecedores.map(f => <option key={f.id} value={f.nome} />)}</datalist>
            </div>
            <div><label>Data de Entrada</label><input type="date" value={dataEntrada} onChange={e => setDataEntrada(e.target.value)} required /></div>
            <div><label>Quantidade (+)</label><input type="number" min="1" value={quantidade} onChange={e => setQuantidade(e.target.value)} required /></div>
            <div><label>Valor de Tabela (R$)</label><input type="text" value={valorUnitario} onChange={e => setValorUnitario(e.target.value)} required title="Preço atualizado para vendas" /></div>
            <button type="submit" style={{ gridColumn: 'span 2', background: produtoExistente ? '#f59e0b' : '#007bff', color: produtoExistente ? 'black' : 'white', fontWeight: 'bold' }}>
              {produtoExistente ? '➕ Somar ao Estoque Existente' : '💾 Cadastrar Novo Produto'}
            </button>
          </form>
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr style={{ backgroundColor: '#334155', color: 'white' }}><th>Ref</th><th>Produto</th><th>Qtd Total</th><th>Valor Tabela</th><th className="no-print">Ação</th></tr></thead>
        <tbody>
          {produtos.map(p => (
            <tr key={p.id}>
              <td style={{ fontWeight: 'bold' }}>{p.referencia}</td><td>{p.nome}</td>
              <td style={{ color: p.quantidade <= 3 ? 'red' : 'black', fontWeight: p.quantidade <= 3 ? 'bold' : 'normal' }}>{p.quantidade} un.</td>
              <td>{p.valorUnitario?.toLocaleString('pt-BR', {style: 'currency', currency:'BRL'})}</td>
              <td className="no-print"><button onClick={() => { setProdutoAtual(p); setModoEdicao(false); setModalAberto(true); }} style={{ background: '#17a2b8', color: 'white', padding: '5px 10px', fontSize: '12px' }}>Ver Histórico</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      {modalAberto && produtoAtual && (
        <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, paddingTop: '20px' }}>
          <div className="card-formulario" style={{ width: '650px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0 }}>Ref: {produtoAtual.referencia}</h3>
              <button onClick={() => setModoEdicao(!modoEdicao)} style={{ background: modoEdicao ? '#6c757d' : '#ffc107', color: 'black', fontWeight: 'bold' }}>
                {modoEdicao ? 'Cancelar Edição' : '✏️ Editar Produto'}
              </button>
            </div>
            
            {modoEdicao ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ gridColumn: 'span 2', fontSize: '12px', background: '#e2e8f0', padding: '10px' }}>⚠️ <strong>Aviso:</strong> Edite aqui apenas para correções de erros. Para dar entrada, use o botão "+ Nova Entrada" na tela anterior.</div>
                <div style={{ gridColumn: 'span 2' }}><label>Nome do Produto</label><input value={produtoAtual.nome} onChange={e => setProdutoAtual({...produtoAtual, nome: e.target.value})} /></div>
                <div><label>Referência</label><input value={produtoAtual.referencia} onChange={e => setProdutoAtual({...produtoAtual, referencia: e.target.value})} /></div>
                <div><label>Quantidade Atual</label><input type="number" value={produtoAtual.quantidade} onChange={e => setProdutoAtual({...produtoAtual, quantidade: e.target.value})} /></div>
                <div><label>Valor de Tabela (R$)</label><input value={produtoAtual.valorUnitario} onChange={e => setProdutoAtual({...produtoAtual, valorUnitario: e.target.value})} /></div>
                <button onClick={salvarEdicao} style={{ gridColumn: 'span 2', background: '#28a745', marginTop: '10px', color: 'white' }}>💾 Confirmar Correção</button>
              </div>
            ) : (
              <div>
                <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '5px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ margin: '0 0 5px 0' }}><strong>Produto:</strong> {produtoAtual.nome}</p>
                    <p style={{ margin: '0' }}><strong>Valor de Tabela Atual:</strong> {produtoAtual.valorUnitario?.toLocaleString('pt-BR', {style: 'currency', currency:'BRL'})}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: '0', fontSize: '24px', fontWeight: 'bold', color: '#0f172a' }}>{produtoAtual.quantidade} un.</p>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>em estoque</span>
                  </div>
                </div>

                <h4 style={{ margin: '0 0 10px 0', borderBottom: '2px solid #e2e8f0', paddingBottom: '5px', color: '#1e293b' }}>🔄 Extrato de Entradas e Saídas</h4>
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#f1f5f9' }}>
                      <tr style={{ textAlign: 'left', color: '#475569' }}>
                        <th style={{ padding: '8px', borderBottom: '2px solid #cbd5e1' }}>Data</th>
                        <th style={{ padding: '8px', borderBottom: '2px solid #cbd5e1' }}>Movimento</th>
                        <th style={{ padding: '8px', borderBottom: '2px solid #cbd5e1' }}>Qtd</th>
                        <th style={{ padding: '8px', borderBottom: '2px solid #cbd5e1' }}>Valor (R$)</th>
                        <th style={{ padding: '8px', borderBottom: '2px solid #cbd5e1' }}>Detalhes</th>
                        {/* NOVO: Coluna de Exclusão só aparece para Gerentes ou Admins */}
                        {isGerenteOuAdmin && <th style={{ padding: '8px', borderBottom: '2px solid #cbd5e1', textAlign: 'center' }}>Ação</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {gerarHistoricoMisto().length === 0 ? (
                        <tr><td colSpan={isGerenteOuAdmin ? 6 : 5} style={{ textAlign: 'center', padding: '15px' }}>Sem movimentações.</td></tr>
                      ) : (
                        gerarHistoricoMisto().map((mov, idx) => (
                          <tr key={idx} style={{ background: idx % 2 === 0 ? 'white' : '#f8fafc' }}>
                            <td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>{mov.data?.split('-').reverse().join('/')}</td>
                            <td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold', color: mov.tipo === 'ENTRADA' ? '#10b981' : '#ef4444' }}>
                              {mov.tipo === 'ENTRADA' ? '↘️ ENTRADA' : '↗️ SAÍDA'}
                            </td>
                            <td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0', fontWeight: 'bold' }}>{mov.tipo === 'ENTRADA' ? '+' : '-'}{mov.qtd}</td>
                            <td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>{mov.valor?.toLocaleString('pt-BR', {style: 'currency', currency:'BRL'})}</td>
                            <td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0', fontSize: '11px', color: '#64748b' }}>{mov.descricao}</td>
                            
                            {/* NOVO: Botão de Lixeira só para Entradas e só para Gerentes */}
                            {isGerenteOuAdmin && (
                              <td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0', textAlign: 'center' }}>
                                {mov.tipo === 'ENTRADA' ? (
                                  <button 
                                    onClick={() => apagarEntrada(mov.indexOriginal, mov.qtd)} 
                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '16px' }} 
                                    title="Apagar Entrada e reduzir estoque"
                                  >
                                    🗑️
                                  </button>
                                ) : (
                                  <span style={{ fontSize: '10px', color: '#94a3b8' }}>-</span>
                                )}
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <button onClick={() => setModalAberto(false)} style={{ background: '#334155', color: 'white', width: '100%', marginTop: '20px' }}>Fechar Painel</button>
          </div>
        </div>
      )}
    </div>
  );
}
