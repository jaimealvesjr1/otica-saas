import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

interface Venda {
  id: string;
  numeroTalao: number;
  dataVenda: string;
  clienteNome: string;
  valorTotal: number;
  vendedor: string;
}

export default function Relatorios() {
  const [vendasTotais, setVendasTotais] = useState<Venda[]>([]);
  const [vendedores, setVendedores] = useState<string[]>([]);
  
  // Filtros
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [vendedorSelecionado, setVendedorSelecionado] = useState('');
  const [comissaoPct, setComissaoPct] = useState('5'); // Padrão de 5%

  const carregarVendas = async () => {
    try {
      const q = query(collection(db, 'vendas'), orderBy('dataVenda', 'desc'));
      const snap = await getDocs(q);
      
      const lista: Venda[] = [];
      const listaVendedores = new Set<string>(); // O 'Set' garante que não teremos nomes repetidos

      snap.forEach((doc) => {
        const dados = doc.data() as Venda;
        lista.push({ ...dados, id: doc.id });
        if (dados.vendedor) listaVendedores.add(dados.vendedor);
      });

      setVendasTotais(lista);
      setVendedores(Array.from(listaVendedores)); // Transforma o Set de volta em uma lista
    } catch (error) {
      console.error("Erro ao carregar relatórios: ", error);
    }
  };

  useEffect(() => {
    carregarVendas();
  }, []);

  // O Segredo: Filtramos a lista de vendas original com base no que o usuário digitou
  const vendasFiltradas = vendasTotais.filter(venda => {
    const atendeDataInicio = dataInicio ? venda.dataVenda >= dataInicio : true;
    const atendeDataFim = dataFim ? venda.dataVenda <= dataFim : true;
    const atendeVendedor = vendedorSelecionado ? venda.vendedor === vendedorSelecionado : true;
    
    return atendeDataInicio && atendeDataFim && atendeVendedor;
  });

  // Calculamos a soma total usando o 'reduce'
  const totalVendido = vendasFiltradas.reduce((soma, venda) => soma + venda.valorTotal, 0);
  const totalComissao = totalVendido * (parseFloat(comissaoPct) / 100);

  return (
    <div className="card-formulario">

      <h2 className="no-print">📊 Relatórios e Comissões</h2>

      {/* Área de Filtros (Não aparece na impressão) */}
      <div className="no-print" style={{ border: '1px solid #ccc', padding: '15px', marginBottom: '20px', borderRadius: '5px', display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        
        <div>
          <label style={{ display: 'block', marginBottom: '5px' }}>Data Início</label>
          <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} style={{ padding: '8px' }} />
        </div>
        
        <div>
          <label style={{ display: 'block', marginBottom: '5px' }}>Data Fim</label>
          <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} style={{ padding: '8px' }} />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '5px' }}>Vendedor</label>
          <select value={vendedorSelecionado} onChange={e => setVendedorSelecionado(e.target.value)} style={{ padding: '8px', minWidth: '150px' }}>
            <option value="">Todos os Vendedores</option>
            {vendedores.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '5px' }}>Comissão (%)</label>
          <input type="number" value={comissaoPct} onChange={e => setComissaoPct(e.target.value)} style={{ padding: '8px', width: '80px' }} />
        </div>

        <button onClick={() => window.print()} style={{ padding: '10px 15px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
          🖨️ Imprimir Relatório
        </button>
      </div>

      {/* ÁREA DE IMPRESSÃO: Cabeçalho do Relatório */}
      <div style={{ marginBottom: '20px' }}>
        <h3>Relatório de Vendas e Comissões</h3>
        <p><strong>Período:</strong> {dataInicio ? dataInicio.split('-').reverse().join('/') : 'Início'} até {dataFim ? dataFim.split('-').reverse().join('/') : 'Hoje'}</p>
        <p><strong>Vendedor:</strong> {vendedorSelecionado || 'Todos'}</p>
      </div>

      <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', marginBottom: '20px' }}>
        <thead>
          <tr style={{ backgroundColor: '#f2f2f2' }}>
            <th style={{ padding: '8px', border: '1px solid #ddd' }}>Data</th>
            <th style={{ padding: '8px', border: '1px solid #ddd' }}>Talão</th>
            <th style={{ padding: '8px', border: '1px solid #ddd' }}>Cliente</th>
            <th style={{ padding: '8px', border: '1px solid #ddd' }}>Vendedor</th>
            <th style={{ padding: '8px', border: '1px solid #ddd' }}>Valor da Venda</th>
          </tr>
        </thead>
        <tbody>
          {vendasFiltradas.length === 0 ? (
            <tr><td colSpan={5} style={{ padding: '8px', textAlign: 'center' }}>Nenhuma venda encontrada para este filtro.</td></tr>
          ) : (
            vendasFiltradas.map((venda) => (
              <tr key={venda.id}>
                <td style={{ padding: '8px', border: '1px solid #ddd' }}>{venda.dataVenda.split('-').reverse().join('/')}</td>
                <td style={{ padding: '8px', border: '1px solid #ddd' }}>{venda.numeroTalao}</td>
                <td style={{ padding: '8px', border: '1px solid #ddd' }}>{venda.clienteNome}</td>
                <td style={{ padding: '8px', border: '1px solid #ddd' }}>{venda.vendedor}</td>
                <td style={{ padding: '8px', border: '1px solid #ddd' }}>{venda.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Resumo Financeiro */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '20px', fontSize: '18px' }}>
        <div style={{ padding: '15px', backgroundColor: '#e9ecef', borderRadius: '5px' }}>
          <strong>Total Vendido: </strong> 
          <span style={{ color: '#28a745' }}>{totalVendido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
        </div>
        <div style={{ padding: '15px', backgroundColor: '#d4edda', borderRadius: '5px' }}>
          <strong>Comissão ({comissaoPct}%): </strong> 
          <span style={{ color: '#155724' }}>{totalComissao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
        </div>
      </div>

    </div>
  );
}
