import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, updateDoc, query, where, getDoc } from 'firebase/firestore';
import { formatarCodigo } from '../utils/geradores';

export default function ContasReceber() {
  const [contas, setContas] = useState<any[]>([]);
  
  // Modal de Pagamento
  const [modalAberto, setModalAberto] = useState(false);
  const [contaAtual, setContaAtual] = useState<any>(null);
  const [valorPago, setValorPago] = useState('');
  const [dataPagamento, setDataPagamento] = useState('');

  const buscarContas = async () => {
    // Busca apenas as vendas feitas no Carnê
    const q = query(collection(db, 'vendas'), where('formaPagamento', '==', 'Carnê'));
    const snap = await getDocs(q);
    
    const lista: any[] = [];
    snap.forEach((doc) => {
      const dados = doc.data();
      // Mostra apenas as que não estão quitadas
      if (!dados.carne?.quitado) lista.push({ ...dados, id: doc.id });
    });
    setContas(lista);
  };

  useEffect(() => { buscarContas(); }, []);

  const abrirModalPagamento = (conta: any) => {
    setContaAtual(conta);
    setDataPagamento(new Date().toISOString().split('T')[0]); // Hoje por padrão
    setValorPago(conta.carne.restante.toString()); // Sugere pagar tudo
    setModalAberto(true);
  };

  const registrarPagamento = async (e: React.FormEvent) => {
    e.preventDefault();
    const valorPagoNum = parseFloat(valorPago.replace(',', '.'));
    
    if (valorPagoNum <= 0 || valorPagoNum > contaAtual.carne.restante) {
      return alert("Valor inválido. Não pode ser maior que o saldo devedor.");
    }

    try {
      const vendaRef = doc(db, 'vendas', contaAtual.id);
      const vendaSnap = await getDoc(vendaRef);
      const dadosAtuais = vendaSnap.data();
      
      const novoRestante = dadosAtuais?.carne.restante - valorPagoNum;
      const novoHistorico = dadosAtuais?.carne.historicoPagamentos || [];
      
      // Salva o registro deste pagamento
      novoHistorico.push({
        data: dataPagamento,
        valor: valorPagoNum
      });

      await updateDoc(vendaRef, {
        'carne.restante': novoRestante,
        'carne.historicoPagamentos': novoHistorico,
        'carne.quitado': novoRestante <= 0 // Se zerou, quita automaticamente!
      });

      alert(novoRestante <= 0 ? "Conta Quitada com Sucesso!" : "Pagamento parcial registrado!");
      setModalAberto(false);
      buscarContas();
    } catch (error) {
      alert("Erro ao registrar pagamento.");
    }
  };

  return (
    <div>
      <style>{`@media print { .no-print { display: none !important; } .print-only { display: block !important; } body { background: white; } }`}</style>
      
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>💸 Gestão de Carnês (A Receber)</h2>
        <button onClick={() => window.print()} style={{ background: '#17a2b8', color: 'white' }}>🖨️ Gerar Relatório</button>
      </div>

      <div className="print-only" style={{ display: 'none', textAlign: 'center', marginBottom: '20px' }}>
        <h2>Relatório de Contas a Receber - Ótica Milenium</h2><hr/>
      </div>
      
      <table style={{ width: '100%', marginTop: '20px', borderCollapse: 'collapse', fontSize: '14px' }}>
        <thead>
          <tr style={{ background: '#fff3cd' }}>
            <th style={{ padding: '10px', textAlign: 'left' }}>Talão</th>
            <th style={{ padding: '10px', textAlign: 'left' }}>Cliente</th>
            <th style={{ padding: '10px', textAlign: 'left' }}>Valor Total</th>
            <th style={{ padding: '10px', textAlign: 'left' }}>Saldo Devedor</th>
            <th className="no-print" style={{ padding: '10px', textAlign: 'left' }}>Ação</th>
          </tr>
        </thead>
        <tbody>
          {contas.length === 0 ? (
            <tr><td colSpan={5} style={{ textAlign: 'center', padding: '15px' }}>🎉 Nenhuma conta em aberto!</td></tr>
          ) : (
            contas.map((c) => (
              <tr key={c.id}>
                <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{formatarCodigo(c.numeroTalao)}</td>
                <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{c.clienteNome}</td>
                <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{c.valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                <td style={{ padding: '10px', borderBottom: '1px solid #eee', color: 'red', fontWeight: 'bold' }}>
                  {c.carne.restante.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td className="no-print" style={{ padding: '10px', borderBottom: '1px solid #eee' }}>
                  <button onClick={() => abrirModalPagamento(c)} style={{ background: '#28a745', padding: '5px 10px', fontSize: '12px', color: 'white' }}>Baixar Pagamento</button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {modalAberto && contaAtual && (
        <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card-formulario" style={{ width: '400px' }}>
            <h3>Lançar Pagamento</h3>
            <p><strong>Cliente:</strong> {contaAtual.clienteNome}</p>
            <p><strong>Devedor Atual:</strong> <span style={{ color: 'red' }}>{contaAtual.carne.restante.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></p>
            <hr style={{ margin: '15px 0', border: '0.5px solid #eee' }} />
            
            <form onSubmit={registrarPagamento} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label>Data do Pagamento</label>
                <input type="date" value={dataPagamento} onChange={e => setDataPagamento(e.target.value)} required />
              </div>
              <div>
                <label>Valor Pago (R$)</label>
                <input type="text" value={valorPago} onChange={e => setValorPago(e.target.value)} required />
                <small style={{ color: '#666' }}>Pode ser um valor parcial ou o total.</small>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="submit" style={{ flex: 1, background: '#28a745' }}>Confirmar Baixa</button>
                <button type="button" onClick={() => setModalAberto(false)} style={{ background: '#dc3545', color: 'white' }}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
