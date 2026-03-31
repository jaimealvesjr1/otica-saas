import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { formatarCodigo } from '../utils/geradores';

export default function Relatorios() {
  const [vendas, setVendas] = useState<any[]>([]);
  
  // Filtros
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [filtroCliente, setFiltroCliente] = useState('');
  const [filtroVendedor, setFiltroVendedor] = useState('');
  const [filtroProduto, setFiltroProduto] = useState('');
  const [filtroStatus, setFiltroStatus] = useState(''); // 'Aberto', 'Quitado' ou '' (Todos)
  
  // Comissão
  const [porcentagemComissao, setPorcentagemComissao] = useState<number>(0);

  const carregarVendas = async () => {
    const snap = await getDocs(collection(db, 'vendas'));
    setVendas(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a: any, b: any) => b.numeroTalao - a.numeroTalao));
  };

  useEffect(() => { carregarVendas(); }, []);

  // Motor de Filtros (A Mágica acontece aqui)
  const vendasFiltradas = vendas.filter(v => {
    // 1. Filtro por Data
    if (dataInicio && v.dataVenda < dataInicio) return false;
    if (dataFim && v.dataVenda > dataFim) return false;
    
    // 2. Filtro por Cliente
    if (filtroCliente && !v.clienteNome?.toLowerCase().includes(filtroCliente.toLowerCase())) return false;
    
    // 3. Filtro por Vendedor
    if (filtroVendedor && v.vendedor !== filtroVendedor) return false;
    
    // 4. Filtro por Status de Pagamento
    if (filtroStatus === 'Aberto') {
      if (v.formaPagamento !== 'Carnê') return false;
      if (v.carne?.quitado) return false;
    }
    if (filtroStatus === 'Quitado') {
      // Se for a vista/cartão é quitado, se for carnê, checa se a flag quitado é true
      if (v.formaPagamento === 'Carnê' && !v.carne?.quitado) return false;
    }

    // 5. Filtro por Produto (Procura dentro do carrinho de compras da venda)
    if (filtroProduto) {
      const temProduto = v.itens?.some((item: any) => item.nome.toLowerCase().includes(filtroProduto.toLowerCase()));
      // Fallback para vendas antigas que não tinham carrinho
      const nomeLegado = v.produtoNome?.toLowerCase().includes(filtroProduto.toLowerCase());
      if (!temProduto && !nomeLegado) return false;
    }

    return true;
  });

  // Cálculos Finais
  const totalVendido = vendasFiltradas.reduce((acc, v) => acc + v.valorTotal, 0);
  const totalComissao = filtroVendedor ? (totalVendido * porcentagemComissao) / 100 : 0;

  // Lista de vendedores únicos para o Select
  const vendedoresUnicos = Array.from(new Set(vendas.map(v => v.vendedor).filter(v => v)));

  return (
    <div>
      {/* Esconde os filtros na hora da impressão para o papel sair limpo */}
      <style>{`@media print { .no-print { display: none !important; } .print-only { display: block !important; } body { background: white; } }`}</style>

      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>📊 Relatórios Gerenciais & Comissões</h2>
        <button onClick={() => window.print()} style={{ background: '#17a2b8', color: 'white' }}>🖨️ Imprimir Relatório</button>
      </div>

      {/* PAINEL DE FILTROS */}
      <div className="card-formulario no-print" style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
          
          <div><label style={{ fontSize: '12px', fontWeight: 'bold' }}>Data Inicial</label><input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} /></div>
          <div><label style={{ fontSize: '12px', fontWeight: 'bold' }}>Data Final</label><input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} /></div>
          <div><label style={{ fontSize: '12px', fontWeight: 'bold' }}>Nome do Cliente</label><input type="text" placeholder="Buscar cliente..." value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)} /></div>
          <div><label style={{ fontSize: '12px', fontWeight: 'bold' }}>Nome do Produto/Lente</label><input type="text" placeholder="Buscar produto..." value={filtroProduto} onChange={e => setFiltroProduto(e.target.value)} /></div>
          
          <div>
            <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Status Financeiro</label>
            <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
              <option value="">Todos (Abertos e Quitados)</option>
              <option value="Aberto">Apenas Carnês em Aberto (Devedores)</option>
              <option value="Quitado">Apenas Vendas Quitadas</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Filtrar por Vendedor (Comissão)</label>
            <select value={filtroVendedor} onChange={e => setFiltroVendedor(e.target.value)}>
              <option value="">Todos os Vendedores</option>
              {vendedoresUnicos.map((vend: any) => <option key={vend} value={vend}>{vend}</option>)}
            </select>
          </div>

          {/* SÓ MOSTRA O CAMPO DE COMISSÃO SE UM VENDEDOR ESPECÍFICO FOR SELECIONADO */}
          {filtroVendedor && (
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#28a745' }}>% de Comissão do Vendedor</label>
              <input type="number" min="0" placeholder="Ex: 5" value={porcentagemComissao} onChange={e => setPorcentagemComissao(Number(e.target.value))} style={{ border: '2px solid #28a745' }} />
            </div>
          )}
          
        </div>
        <button onClick={() => { setDataInicio(''); setDataFim(''); setFiltroCliente(''); setFiltroProduto(''); setFiltroStatus(''); setFiltroVendedor(''); setPorcentagemComissao(0); }} style={{ background: '#6c757d', width: '200px', alignSelf: 'flex-end', color: 'white' }}>
          Limpar Filtros
        </button>
      </div>

      {/* CABEÇALHO PARA IMPRESSÃO (Só aparece quando imprime) */}
      <div className="print-only" style={{ display: 'none', textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid black', paddingBottom: '10px' }}>
        <h2>Relatório de Vendas - Ótica Milenium</h2>
        <p><strong>Período:</strong> {dataInicio ? dataInicio.split('-').reverse().join('/') : 'Início'} até {dataFim ? dataFim.split('-').reverse().join('/') : 'Hoje'}</p>
        <p><strong>Filtros aplicados:</strong> {filtroCliente && `Cliente: ${filtroCliente} |`} {filtroProduto && `Produto: ${filtroProduto} |`} {filtroStatus && `Status: ${filtroStatus} |`} {filtroVendedor && `Vendedor: ${filtroVendedor}`}</p>
      </div>

      {/* RESUMO FINANCEIRO (Soma tudo o que foi filtrado) */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
        <div style={{ flex: 1, padding: '20px', background: '#e2e8f0', borderRadius: '8px', borderLeft: '5px solid #3b82f6' }}>
          <p style={{ margin: 0, fontWeight: 'bold', color: '#475569' }}>Total em Vendas (Filtro Atual)</p>
          <h2 style={{ margin: '5px 0 0 0', color: '#0f172a' }}>{totalVendido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h2>
        </div>
        
        {/* CAIXA DE COMISSÃO (Só aparece se houver filtro por vendedor) */}
        {filtroVendedor && (
          <div style={{ flex: 1, padding: '20px', background: '#dcfce7', borderRadius: '8px', borderLeft: '5px solid #22c55e' }}>
            <p style={{ margin: 0, fontWeight: 'bold', color: '#166534' }}>Comissão a Pagar ({porcentagemComissao}%)</p>
            <h2 style={{ margin: '5px 0 0 0', color: '#14532d' }}>{totalComissao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h2>
          </div>
        )}
      </div>

      {/* TABELA DE DADOS FILTRADOS */}
      <table style={{ width: '100%', fontSize: '14px' }}>
        <thead>
          <tr style={{ background: '#334155', color: 'white' }}>
            <th>Talão / Data</th><th>Cliente</th><th>Vendedor</th><th>Pagamento / Status</th><th>Valor Total</th>
          </tr>
        </thead>
        <tbody>
          {vendasFiltradas.length === 0 ? (
            <tr><td colSpan={5} style={{ textAlign: 'center', padding: '20px' }}>Nenhuma venda encontrada com estes filtros.</td></tr>
          ) : (
            vendasFiltradas.map(v => (
              <tr key={v.id}>
                <td><strong>{formatarCodigo(v.numeroTalao)}</strong><br/><span style={{ fontSize: '12px', color: '#666' }}>{v.dataVenda.split('-').reverse().join('/')}</span></td>
                <td>{v.clienteNome}</td>
                <td>{v.vendedor || 'Não informado'}</td>
                <td>
                  {v.formaPagamento}
                  {v.formaPagamento === 'Carnê' && (
                    <span style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: v.carne?.quitado ? 'green' : 'red' }}>
                      ({v.carne?.quitado ? 'Quitado' : `Devedor: ${v.carne?.restante.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`})
                    </span>
                  )}
                </td>
                <td style={{ fontWeight: 'bold' }}>{v.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
