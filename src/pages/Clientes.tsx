// src/pages/Clientes.tsx
import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { collection, addDoc, getDocs, doc, updateDoc, query, where, deleteDoc } from 'firebase/firestore';
import { obterProximoCodigo, formatarCodigo } from '../utils/geradores';
import { formatarCPF, formatarTelefone } from '../utils/mascaras';
import { useAuth } from '../contexts/AuthContext';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';

interface Graus { esf: string; cil: string; eixo: string; dnp: string; aco: string; ap: string; }
interface ReceitaOculos { longeOD: Graus; longeOE: Graus; pertoOD: Graus; pertoOE: Graus; }

const receitaVazia: ReceitaOculos = { 
  longeOD: { esf: '', cil: '', eixo: '', dnp: '', aco: '', ap: '' }, 
  longeOE: { esf: '', cil: '', eixo: '', dnp: '', aco: '', ap: '' }, 
  pertoOD: { esf: '', cil: '', eixo: '', dnp: '', aco: '', ap: '' }, 
  pertoOE: { esf: '', cil: '', eixo: '', dnp: '', aco: '', ap: '' } 
};

const TabelaPrescricao = ({ receita, onChange, modoLeitura = false }: { receita: ReceitaOculos, onChange?: any, modoLeitura?: boolean }) => {
  const colunas = ['ESF', 'CIL', 'EIXO', 'DNP', 'ACO', 'AP'];
  const linhas = [
    { label: 'Longe OD', chave: 'longeOD' as keyof ReceitaOculos, bg: '#f8fafc' }, 
    { label: 'Longe OE', chave: 'longeOE' as keyof ReceitaOculos, bg: '#f8fafc' }, 
    { label: 'Perto OD', chave: 'pertoOD' as keyof ReceitaOculos, bg: '#fffbeb' }, 
    { label: 'Perto OE', chave: 'pertoOE' as keyof ReceitaOculos, bg: '#fffbeb' }
  ];
  const props = ['esf', 'cil', 'eixo', 'dnp', 'aco', 'ap'];
  
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', background: 'white' }}>
      <thead>
        <tr style={{ background: '#334155', color: 'white' }}>
          <th style={{ padding: '6px' }}></th>
          {colunas.map(c => <th key={c} style={{ padding: '6px', textAlign: 'center', border: '1px solid #475569' }}>{c}</th>)}
        </tr>
      </thead>
      <tbody>
        {linhas.map(l => (
          <tr key={l.chave} style={{ backgroundColor: l.bg }}>
            <td style={{ padding: '6px', fontWeight: 'bold', border: '1px solid #cbd5e1', whiteSpace: 'nowrap' }}>{l.label}</td>
            {props.map(prop => (
              <td key={prop} style={{ padding: '4px', border: '1px solid #cbd5e1' }}>
                {modoLeitura ? (
                  <div style={{ textAlign: 'center', fontWeight: 'bold' }}>{receita?.[l.chave]?.[prop as keyof Graus] || '-'}</div>
                ) : (
                  <input type="text" style={{ width: '100%', padding: '4px', textAlign: 'center', border: '1px solid #ccc', borderRadius: '3px' }} value={receita?.[l.chave]?.[prop as keyof Graus] || ''} onChange={e => onChange(l.chave, prop as keyof Graus, e.target.value)} />
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default function Clientes() {
  const { user } = useAuth();
  const isGerenteOuAdmin = ['admin', 'gerente'].includes(user?.cargo?.toLowerCase() || '');

  const [clientes, setClientes] = useState<any[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  
  // Campos de Cadastro
  const [nome, setNome] = useState(''); const [cpf, setCpf] = useState(''); const [telefone, setTelefone] = useState(''); const [dataNascimento, setDataNascimento] = useState('');
  const [logradouro, setLogradouro] = useState(''); const [numero, setNumero] = useState(''); const [complemento, setComplemento] = useState(''); const [bairro, setBairro] = useState(''); const [cidade, setCidade] = useState('');
  const [medico, setMedico] = useState(''); const [ultimaConsulta, setUltimaConsulta] = useState(''); const [observacoes, setObservacoes] = useState('');
  const [receitaOculos, setReceitaOculos] = useState<ReceitaOculos>(JSON.parse(JSON.stringify(receitaVazia)));

  // Controle de Modal
  const [modalAberto, setModalAberto] = useState(false);
  const [clienteAtual, setClienteAtual] = useState<any>(null);
  const [clienteOriginal, setClienteOriginal] = useState<any>(null); 
  const [modoEdicao, setModoEdicao] = useState(false);
  const [comprasCliente, setComprasCliente] = useState<any[]>([]);

  // Segurança Exclusão
  const [modalSeguranca, setModalSeguranca] = useState(false);
  const [senhaConfirmacao, setSenhaConfirmacao] = useState('');
  const [itemParaExcluir, setItemParaExcluir] = useState<{ tipo: 'cliente' | 'prescricao', idCliente: string, idxPrescricao?: number, nome?: string }>({ tipo: 'cliente', idCliente: '' });

  const buscarClientes = async () => { 
    const snap = await getDocs(collection(db, 'clientes')); 
    setClientes(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a:any, b:any) => b.codigo - a.codigo)); 
  };
  
  useEffect(() => { buscarClientes(); }, []);

  const carregarComprasDoCliente = async (clienteId: string) => {
    const q = query(collection(db, 'vendas'), where('clienteId', '==', clienteId));
    const snap = await getDocs(q); 
    const compras = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    compras.sort((a: any, b: any) => new Date(b.dataVenda).getTime() - new Date(a.dataVenda).getTime());
    setComprasCliente(compras);
  };

  const cadastrarCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 🚀 TRAVA: CPF AGORA É ESTRITAMENTE OBRIGATÓRIO E COMPLETO
    if (!cpf || cpf.length < 14) {
      return alert("⛔ Erro: O CPF é obrigatório e deve estar completo (11 dígitos).");
    }
    
    if (clientes.find(c => c.cpf === cpf)) {
      return alert("⛔ Erro: Este CPF já está cadastrado no sistema!");
    }

    const codigoSeq = await obterProximoCodigo('clientes');
    await addDoc(collection(db, 'clientes'), { 
      codigo: codigoSeq, nome, cpf, telefone, dataNascimento, 
      endereco: { logradouro, numero, complemento, bairro, cidade }, 
      dadosClinicos: { medico, ultimaConsulta, observacoes, receitaOculos, historicoEvolucao: [] } 
    });
    alert('Ficha cadastrada com sucesso!'); setMostrarForm(false); buscarClientes();
    setNome(''); setCpf(''); setTelefone(''); setDataNascimento(''); setLogradouro(''); setNumero(''); setComplemento(''); setBairro(''); setCidade(''); setMedico(''); setUltimaConsulta(''); setObservacoes(''); setReceitaOculos(JSON.parse(JSON.stringify(receitaVazia)));
  };

  const salvarEdicao = async () => {
    // 🚀 TRAVA: CPF OBRIGATÓRIO NA EDIÇÃO TAMBÉM
    if (!clienteAtual.cpf || clienteAtual.cpf.length < 14) {
      return alert("⛔ Erro: O CPF não pode ficar em branco ou incompleto.");
    }

    if (clientes.find(c => c.cpf === clienteAtual.cpf && c.id !== clienteAtual.id)) {
      return alert("⛔ Erro: CPF já cadastrado em outro cliente!");
    }

    try {
      let dadosClinicosAtualizados = { ...clienteAtual.dadosClinicos };
      const clinicoOriginalStr = JSON.stringify(clienteOriginal.dadosClinicos || {});
      const clinicoAtualStr = JSON.stringify(clienteAtual.dadosClinicos || {});
      if (clinicoOriginalStr !== clinicoAtualStr) {
        const historicoAntigo = clienteAtual.dadosClinicos?.historicoEvolucao || [];
        const registroHistorico = { dataAlteracao: new Date().toISOString(), medico: clienteOriginal.dadosClinicos?.medico || '', ultimaConsulta: clienteOriginal.dadosClinicos?.ultimaConsulta || '', receitaOculos: clienteOriginal.dadosClinicos?.receitaOculos || null, observacoes: clienteOriginal.dadosClinicos?.observacoes || '' };
        dadosClinicosAtualizados = { ...clienteAtual.dadosClinicos, historicoEvolucao: [registroHistorico, ...historicoAntigo] };
      }
      await updateDoc(doc(db, 'clientes', clienteAtual.id), { ...clienteAtual, dadosClinicos: dadosClinicosAtualizados });
      alert('Alterações salvas!'); setModoEdicao(false); setClienteOriginal(JSON.parse(JSON.stringify({ ...clienteAtual, dadosClinicos: dadosClinicosAtualizados }))); setClienteAtual({ ...clienteAtual, dadosClinicos: dadosClinicosAtualizados }); buscarClientes();
    } catch (error) { alert('Erro ao salvar edições.'); }
  };

  // LÓGICA DE EXCLUSÃO SEGURA
  const confirmarExclusaoSegura = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !user?.email) return;
    try {
      const credencial = EmailAuthProvider.credential(user.email, senhaConfirmacao);
      await reauthenticateWithCredential(auth.currentUser, credencial); // Valida a senha
      
      if (itemParaExcluir.tipo === 'cliente') {
        await deleteDoc(doc(db, 'clientes', itemParaExcluir.idCliente));
        alert('Cliente excluído do sistema!');
        setModalAberto(false);
      } else if (itemParaExcluir.tipo === 'prescricao') {
        const novoHistorico = [...clienteAtual.dadosClinicos.historicoEvolucao];
        novoHistorico.splice(itemParaExcluir.idxPrescricao!, 1);
        await updateDoc(doc(db, 'clientes', itemParaExcluir.idCliente), { 'dadosClinicos.historicoEvolucao': novoHistorico });
        setClienteAtual({ ...clienteAtual, dadosClinicos: { ...clienteAtual.dadosClinicos, historicoEvolucao: novoHistorico } });
        alert('Prescrição antiga excluída!');
      }
      setModalSeguranca(false); setSenhaConfirmacao(''); buscarClientes();
    } catch (error) {
      alert('⛔ Senha incorreta! Ação não autorizada.');
    }
  };

  return (
    <div>
      <style>{`@media print { .no-print { display: none !important; } .print-only { display: block !important; } }`}</style>
      
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>👥 Clientes & Fichas</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => window.print()} style={{ background: '#17a2b8', color: 'white' }}>🖨️ Gerar Relatório</button>
          <button onClick={() => setMostrarForm(!mostrarForm)} style={{ background: mostrarForm ? '#6c757d' : '#28a745', color: 'white' }}>{mostrarForm ? 'Cancelar' : '+ Novo Cliente'}</button>
        </div>
      </div>
      
      {/* FORM DE CADASTRO */}
      {mostrarForm && (
        <div className="card-formulario no-print" style={{ marginBottom: '20px' }}>
          <form onSubmit={cadastrarCliente} style={{ display: 'grid', gap: '15px', gridTemplateColumns: '1fr 1fr' }}>
            <h4 style={{ gridColumn: 'span 2', borderBottom: '1px solid #eee', margin: 0 }}>Dados Pessoais</h4>
            <div><label>Nome Completo</label><input type="text" value={nome} onChange={e => setNome(e.target.value)} required /></div>
            <div><label>Celular</label><input type="text" value={telefone} onChange={e => setTelefone(formatarTelefone(e.target.value))} required maxLength={15} /></div>
            
            {/* 🚀 MUDANÇA: CPF com "required" na criação */}
            <div><label style={{ fontWeight: 'bold' }}>CPF *</label><input type="text" value={cpf} onChange={e => setCpf(formatarCPF(e.target.value))} required maxLength={14} placeholder="000.000.000-00" style={{ border: '1px solid #007bff' }} /></div>
            
            <div><label>Data Nasc.</label><input type="date" value={dataNascimento} onChange={e => setDataNascimento(e.target.value)} /></div>
            
            <h4 style={{ gridColumn: 'span 2', borderBottom: '1px solid #eee', margin: 0, marginTop: '10px' }}>Endereço</h4>
            <div style={{ gridColumn: 'span 2' }}><label>Logradouro (Rua/Av)</label><input type="text" value={logradouro} onChange={e => setLogradouro(e.target.value)} /></div>
            <div><label>Número</label><input type="text" value={numero} onChange={e => setNumero(e.target.value)} /></div>
            <div><label>Complemento</label><input type="text" value={complemento} onChange={e => setComplemento(e.target.value)} /></div>
            <div><label>Bairro</label><input type="text" value={bairro} onChange={e => setBairro(e.target.value)} /></div>
            <div><label>Cidade</label><input type="text" value={cidade} onChange={e => setCidade(e.target.value)} /></div>

            <button type="submit" style={{ gridColumn: 'span 2', padding: '12px', background: '#007bff', color: 'white' }}>💾 Cadastrar Cliente</button>
          </form>
        </div>
      )}

      {/* TABELA DE LISTAGEM */}
      <table style={{ marginTop: '20px', width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{background: '#334155', color: 'white'}}>
            <th>Cód</th><th>Nome</th><th>Telefone</th><th>CPF</th><th className="no-print" style={{textAlign:'center'}}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {clientes.map(c => (
             <tr key={c.id}>
                <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{formatarCodigo(c.codigo)}</td>
                <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{c.nome}</td>
                <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{c.telefone}</td>
                <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{c.cpf}</td>
                <td className="no-print" style={{ padding: '10px', borderBottom: '1px solid #eee', textAlign: 'center' }}>
                  <button onClick={() => { setClienteAtual(c); setClienteOriginal(JSON.parse(JSON.stringify(c))); setModoEdicao(false); setModalAberto(true); carregarComprasDoCliente(c.id); }} style={{background: '#17a2b8', color: 'white', fontSize: '12px', padding: '5px 10px', marginRight: '5px'}}>Abrir Prontuário</button>
                  {isGerenteOuAdmin && <button onClick={() => { setItemParaExcluir({ tipo: 'cliente', idCliente: c.id, nome: c.nome }); setModalSeguranca(true); }} style={{ background: '#ef4444', color: 'white', padding: '5px 10px', fontSize: '12px' }}>🗑️</button>}
                </td>
             </tr>
          ))}
        </tbody>
      </table>

      {/* MODAL DE PRONTUÁRIO */}
      {modalAberto && clienteAtual && (
        <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, paddingTop: '20px' }}>
          <div className="card-formulario" style={{ width: '750px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h2 style={{ margin: 0, color: '#1e293b' }}>Prontuário: {clienteAtual.nome}</h2>
              <button onClick={() => setModoEdicao(!modoEdicao)} style={{ background: modoEdicao ? '#6c757d' : '#ffc107', color: 'white' }}>{modoEdicao ? 'Cancelar Edição' : '✏️ Editar / Nova Prescrição'}</button>
            </div>

            {modoEdicao ? (
              <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: '1fr 1fr' }}>
                <h4 style={{ gridColumn: 'span 2', margin: 0, borderBottom: '1px solid #eee' }}>Dados Pessoais</h4>
                <div><label>Nome</label><input value={clienteAtual.nome} onChange={e => setClienteAtual({...clienteAtual, nome: e.target.value})} required /></div>
                <div><label>Telefone</label><input value={clienteAtual.telefone} onChange={e => setClienteAtual({...clienteAtual, telefone: formatarTelefone(e.target.value)})} required /></div>
                
                {/* 🚀 MUDANÇA: CPF com "required" na edição */}
                <div><label style={{ fontWeight: 'bold' }}>CPF *</label><input value={clienteAtual.cpf || ''} onChange={e => setClienteAtual({...clienteAtual, cpf: formatarCPF(e.target.value)})} required maxLength={14} style={{ border: '1px solid #007bff' }} /></div>
                
                <div><label>Data Nasc.</label><input type="date" value={clienteAtual.dataNascimento} onChange={e => setClienteAtual({...clienteAtual, dataNascimento: e.target.value})} /></div>
                
                <h4 style={{ gridColumn: 'span 2', margin: '15px 0 0 0', borderBottom: '1px solid #eee' }}>Endereço</h4>
                <div style={{ gridColumn: 'span 2' }}><label>Logradouro (Rua/Av)</label><input value={clienteAtual.endereco?.logradouro || ''} onChange={e => setClienteAtual({...clienteAtual, endereco: {...clienteAtual.endereco, logradouro: e.target.value}})} /></div>
                <div><label>Número</label><input value={clienteAtual.endereco?.numero || ''} onChange={e => setClienteAtual({...clienteAtual, endereco: {...clienteAtual.endereco, numero: e.target.value}})} /></div>
                <div><label>Complemento</label><input value={clienteAtual.endereco?.complemento || ''} onChange={e => setClienteAtual({...clienteAtual, endereco: {...clienteAtual.endereco, complemento: e.target.value}})} /></div>
                <div><label>Bairro</label><input value={clienteAtual.endereco?.bairro || ''} onChange={e => setClienteAtual({...clienteAtual, endereco: {...clienteAtual.endereco, bairro: e.target.value}})} /></div>
                <div><label>Cidade</label><input value={clienteAtual.endereco?.cidade || ''} onChange={e => setClienteAtual({...clienteAtual, endereco: {...clienteAtual.endereco, cidade: e.target.value}})} /></div>
                
                <h4 style={{ gridColumn: 'span 2', margin: '15px 0 0 0', borderBottom: '1px solid #eee', color: '#007bff' }}>Nova Prescrição (Irá salvar a antiga no Histórico)</h4>
                <div><label>Médico Solicitante</label><input value={clienteAtual.dadosClinicos?.medico || ''} onChange={e => setClienteAtual({...clienteAtual, dadosClinicos: {...clienteAtual.dadosClinicos, medico: e.target.value}})} /></div>
                <div><label>Data da Consulta</label><input type="date" value={clienteAtual.dadosClinicos?.ultimaConsulta || ''} onChange={e => setClienteAtual({...clienteAtual, dadosClinicos: {...clienteAtual.dadosClinicos, ultimaConsulta: e.target.value}})} /></div>
                <div style={{ gridColumn: 'span 2', overflowX: 'auto' }}><TabelaPrescricao receita={clienteAtual.dadosClinicos?.receitaOculos || receitaVazia} onChange={(chave: keyof ReceitaOculos, prop: keyof Graus, val: string) => { const clinicos = clienteAtual.dadosClinicos || {}; const recAtual = clinicos.receitaOculos || receitaVazia; setClienteAtual({ ...clienteAtual, dadosClinicos: { ...clinicos, receitaOculos: { ...recAtual, [chave]: { ...recAtual[chave], [prop]: val } } } }); }} /></div>
                
                <button onClick={salvarEdicao} style={{ gridColumn: 'span 2', background: '#28a745', marginTop: '10px', color: 'white' }}>💾 Salvar Ficha</button>
              </div>
            ) : (
              <>
                <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #e2e8f0' }}>
                  <p style={{ margin: '0 0 5px 0', fontSize: '14px' }}><strong>Telefone:</strong> {clienteAtual.telefone} | <strong>CPF:</strong> {clienteAtual.cpf}</p>
                  <p style={{ margin: '0 0 5px 0', fontSize: '14px' }}><strong>Data Nasc.:</strong> {clienteAtual.dataNascimento ? clienteAtual.dataNascimento.split('-').reverse().join('/') : 'Não informada'}</p>
                  <p style={{ margin: 0, fontSize: '14px' }}><strong>Endereço:</strong> {clienteAtual.endereco?.logradouro || 'Rua não informada'}, {clienteAtual.endereco?.numero} {clienteAtual.endereco?.complemento && `(${clienteAtual.endereco?.complemento})`} - {clienteAtual.endereco?.bairro}, {clienteAtual.endereco?.cidade}</p>
                </div>

                <h3 style={{ color: '#0f172a', borderBottom: '1px solid #eee', paddingBottom: '5px' }}>🛍️ Histórico Comercial (Compras)</h3>
                {comprasCliente.length === 0 ? (
                  <p style={{ fontSize: '13px', color: '#64748b' }}>Nenhuma compra registrada para este cliente.</p>
                ) : (
                  <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '20px' }}>
                    <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                      <thead style={{ background: '#f1f5f9', position: 'sticky', top: 0 }}>
                        <tr>
                          <th style={{ padding: '8px', textAlign: 'left' }}>Talão / Data</th>
                          <th style={{ padding: '8px', textAlign: 'left' }}>Produtos</th>
                          <th style={{ padding: '8px', textAlign: 'left' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comprasCliente.map((c, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '8px', verticalAlign: 'top' }}>
                              <strong>{formatarCodigo(c.numeroTalao)}</strong><br/>
                              <span style={{ fontSize:'11px', color: '#64748b' }}>{c.dataVenda?.split('-').reverse().join('/')}</span>
                            </td>
                            <td style={{ padding: '8px', verticalAlign: 'top' }}>
                              {c.itens?.map((it:any, idx:number) => (
                                <div key={idx}>{it.quantidade}x {it.nome}</div>
                              ))}
                            </td>
                            <td style={{ padding: '8px', fontWeight: 'bold', verticalAlign: 'top' }}>
                              {c.valorTotal?.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <h3 style={{ color: '#007bff' }}>👁️ Prescrição Atual</h3>
                <p><strong>Médico:</strong> {clienteAtual.dadosClinicos?.medico || 'N/A'} | <strong>Consulta:</strong> {clienteAtual.dadosClinicos?.ultimaConsulta ? clienteAtual.dadosClinicos.ultimaConsulta.split('-').reverse().join('/') : 'N/A'}</p>
                {clienteAtual.dadosClinicos?.receitaOculos ? (
                  <div style={{ overflowX: 'auto' }}><TabelaPrescricao receita={clienteAtual.dadosClinicos.receitaOculos} modoLeitura={true} /></div>
                ) : (
                  <p style={{ color: '#666', fontStyle: 'italic' }}>Sem receita ativa.</p>
                )}

                {clienteAtual.dadosClinicos?.historicoEvolucao?.length > 0 && (
                  <div style={{ marginTop: '20px', padding: '15px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px' }}>
                    <h3 style={{ margin: '0 0 10px 0', color: '#d97706', fontSize: '16px' }}>⏳ Histórico de Receitas Anteriores</h3>
                    {clienteAtual.dadosClinicos.historicoEvolucao.map((hist: any, i: number) => (
                      <div key={i} style={{ marginBottom: '15px', paddingBottom: '10px', borderBottom: '1px dashed #d97706', position: 'relative' }}>
                        {isGerenteOuAdmin && (
                          <button onClick={() => { setItemParaExcluir({ tipo: 'prescricao', idCliente: clienteAtual.id, idxPrescricao: i }); setModalSeguranca(true); }} style={{ position: 'absolute', top: 0, right: 0, background: 'transparent', border: 'none', color: '#ef4444', fontSize: '16px', cursor: 'pointer' }} title="Excluir Lançamento">🗑️</button>
                        )}
                        <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#92400e', fontWeight: 'bold' }}>📅 Arquivado em: {new Date(hist.dataAlteracao).toLocaleDateString('pt-BR')}</p>
                        {hist.receitaOculos && <div style={{ opacity: 0.8 }}><TabelaPrescricao receita={hist.receitaOculos} modoLeitura={true} /></div>}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            <button onClick={() => setModalAberto(false)} style={{ background: 'red', color: 'white', width: '100%', marginTop: '20px' }}>Fechar Prontuário</button>
          </div>
        </div>
      )}

      {modalSeguranca && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div className="card-formulario" style={{ width: '400px', textAlign: 'center' }}>
            <h3 style={{ color: '#ef4444', marginTop: 0 }}>⚠️ Confirmação de Exclusão</h3>
            <p>Você está prestes a excluir {itemParaExcluir.tipo === 'cliente' ? `o cliente ${itemParaExcluir.nome}` : 'um registro de prescrição do histórico'}.</p>
            <form onSubmit={confirmarExclusaoSegura}>
              <input type="password" placeholder="Digite sua senha para confirmar" required value={senhaConfirmacao} onChange={e => setSenhaConfirmacao(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '15px', textAlign: 'center', border: '2px solid #ef4444' }} />
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" style={{ background: '#ef4444', color: 'white', flex: 1 }}>Apagar Definitivamente</button>
                <button type="button" onClick={() => { setModalSeguranca(false); setSenhaConfirmacao(''); }} style={{ background: '#64748b', color: 'white', flex: 1 }}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
