import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, doc, updateDoc } from 'firebase/firestore';
import { obterProximoCodigo, formatarCodigo } from '../utils/geradores';
import { formatarCPF, formatarTelefone } from '../utils/mascaras';

// --- NOVAS INTERFACES DE PRESCRIÇÃO OFICIAL ---
interface Graus { esf: string; cil: string; eixo: string; dnp: string; aco: string; ap: string; }
interface ReceitaOculos { longeOD: Graus; longeOE: Graus; pertoOD: Graus; pertoOE: Graus; }

const receitaVazia: ReceitaOculos = {
  longeOD: { esf: '', cil: '', eixo: '', dnp: '', aco: '', ap: '' },
  longeOE: { esf: '', cil: '', eixo: '', dnp: '', aco: '', ap: '' },
  pertoOD: { esf: '', cil: '', eixo: '', dnp: '', aco: '', ap: '' },
  pertoOE: { esf: '', cil: '', eixo: '', dnp: '', aco: '', ap: '' },
};

// 🚨 SOLUÇÃO: A TABELA AGORA FICA DO LADO DE FORA PARA NÃO PERDER O FOCO 🚨
const TabelaPrescricao = ({ receita, onChange, modoLeitura = false }: { receita: ReceitaOculos, onChange?: any, modoLeitura?: boolean }) => {
  const colunas = ['ESFÉRICO', 'CILÍNDRICO', 'EIXO', 'DNP', 'ACO', 'AP'];
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
                  <input 
                    type="text" 
                    style={{ width: '100%', padding: '4px', textAlign: 'center', border: '1px solid #ccc', borderRadius: '3px' }}
                    value={receita?.[l.chave]?.[prop as keyof Graus] || ''}
                    onChange={e => onChange(l.chave, prop as keyof Graus, e.target.value)}
                  />
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};


// --- AGORA SIM COMEÇA A TELA PRINCIPAL DE CLIENTES ---
export default function Clientes() {
  const [clientes, setClientes] = useState<any[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  
  // Campos Básicos e Endereço
  const [nome, setNome] = useState(''); const [cpf, setCpf] = useState(''); const [telefone, setTelefone] = useState(''); const [dataNascimento, setDataNascimento] = useState('');
  const [logradouro, setLogradouro] = useState(''); const [numero, setNumero] = useState(''); const [complemento, setComplemento] = useState(''); const [bairro, setBairro] = useState(''); const [cidade, setCidade] = useState('');

  // Dados Clínicos Novos
  const [medico, setMedico] = useState('');
  const [ultimaConsulta, setUltimaConsulta] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [receitaOculos, setReceitaOculos] = useState<ReceitaOculos>(JSON.parse(JSON.stringify(receitaVazia)));

  // Modal e Edição
  const [modalAberto, setModalAberto] = useState(false);
  const [clienteAtual, setClienteAtual] = useState<any>(null);
  const [clienteOriginal, setClienteOriginal] = useState<any>(null); 
  const [modoEdicao, setModoEdicao] = useState(false);

  const buscarClientes = async () => {
    const snap = await getDocs(collection(db, 'clientes'));
    setClientes(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a:any, b:any) => b.codigo - a.codigo));
  };

  useEffect(() => { buscarClientes(); }, []);

  const cadastrarCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    const codigoSeq = await obterProximoCodigo('clientes');
    
    await addDoc(collection(db, 'clientes'), {
      codigo: codigoSeq, nome, cpf, telefone, dataNascimento,
      endereco: { logradouro, numero, complemento, bairro, cidade },
      dadosClinicos: { medico, ultimaConsulta, observacoes, receitaOculos, historicoEvolucao: [] }
    });
    alert('Ficha cadastrada com sucesso!');
    setMostrarForm(false); buscarClientes();
    
    // Resetar Form
    setNome(''); setCpf(''); setTelefone(''); setDataNascimento('');
    setLogradouro(''); setNumero(''); setComplemento(''); setBairro(''); setCidade('');
    setMedico(''); setUltimaConsulta(''); setObservacoes(''); setReceitaOculos(JSON.parse(JSON.stringify(receitaVazia)));
  };

  const salvarEdicao = async () => {
    try {
      let dadosClinicosAtualizados = { ...clienteAtual.dadosClinicos };

      const clinicoOriginalStr = JSON.stringify(clienteOriginal.dadosClinicos || {});
      const clinicoAtualStr = JSON.stringify(clienteAtual.dadosClinicos || {});

      if (clinicoOriginalStr !== clinicoAtualStr) {
        const historicoAntigo = clienteAtual.dadosClinicos?.historicoEvolucao || [];
        const registroHistorico = {
          dataAlteracao: new Date().toISOString(),
          medico: clienteOriginal.dadosClinicos?.medico || '',
          ultimaConsulta: clienteOriginal.dadosClinicos?.ultimaConsulta || '',
          receitaOculos: clienteOriginal.dadosClinicos?.receitaOculos || null,
          receitas: clienteOriginal.dadosClinicos?.receitas || [],
          observacoes: clienteOriginal.dadosClinicos?.observacoes || ''
        };
        dadosClinicosAtualizados = { ...clienteAtual.dadosClinicos, historicoEvolucao: [registroHistorico, ...historicoAntigo] };
      }

      const clienteRef = doc(db, 'clientes', clienteAtual.id);
      await updateDoc(clienteRef, { ...clienteAtual, dadosClinicos: dadosClinicosAtualizados });
      
      alert('Alterações salvas com sucesso!');
      setModoEdicao(false);
      setClienteOriginal(JSON.parse(JSON.stringify({ ...clienteAtual, dadosClinicos: dadosClinicosAtualizados })));
      setClienteAtual({ ...clienteAtual, dadosClinicos: dadosClinicosAtualizados });
      buscarClientes();
    } catch (error) { alert('Erro ao salvar edições.'); }
  };

  return (
    <div>
      <style>{`@media print { .no-print { display: none !important; } .print-only { display: block !important; } }`}</style>
      
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>👥 Clientes & Fichas Clínicas</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => window.print()} style={{ background: '#17a2b8', color: 'white' }}>🖨️ Gerar Relatório</button>
          <button onClick={() => setMostrarForm(!mostrarForm)} style={{ background: mostrarForm ? '#6c757d' : '#28a745', color: 'white' }}>
            {mostrarForm ? 'Cancelar / Fechar' : '+ Novo Cliente'}
          </button>
        </div>
      </div>

      <div className="print-only" style={{ display: 'none', textAlign: 'center', marginBottom: '20px' }}>
        <h2>Relatório de Clientes - Ótica Milenium</h2><hr/>
      </div>

      {mostrarForm && (
        <div className="card-formulario no-print" style={{ marginBottom: '20px' }}>
          <form onSubmit={cadastrarCliente} style={{ display: 'grid', gap: '15px', gridTemplateColumns: '1fr 1fr' }}>
            
            <h4 style={{ gridColumn: 'span 2', borderBottom: '1px solid #eee', margin: 0 }}>Dados Pessoais</h4>
            <div><label>Nome Completo</label><input type="text" value={nome} onChange={e => setNome(e.target.value)} required /></div>
            <div><label>Celular / Telefone</label><input type="text" value={telefone} onChange={e => setTelefone(formatarTelefone(e.target.value))} required maxLength={15} /></div>
            <div><label>CPF</label><input type="text" value={cpf} onChange={e => setCpf(formatarCPF(e.target.value))} maxLength={14} /></div>
            <div><label>Data de Nascimento</label><input type="date" value={dataNascimento} onChange={e => setDataNascimento(e.target.value)} /></div>

            <h4 style={{ gridColumn: 'span 2', borderBottom: '1px solid #eee', margin: 0, marginTop: '10px' }}>Endereço</h4>
            <div style={{ gridColumn: 'span 2' }}><label>Logradouro (Rua/Av)</label><input type="text" value={logradouro} onChange={e => setLogradouro(e.target.value)} /></div>
            <div><label>Número</label><input type="text" value={numero} onChange={e => setNumero(e.target.value)} /></div>
            <div><label>Complemento</label><input type="text" value={complemento} onChange={e => setComplemento(e.target.value)} /></div>
            <div><label>Bairro</label><input type="text" value={bairro} onChange={e => setBairro(e.target.value)} /></div>
            <div><label>Cidade</label><input type="text" value={cidade} onChange={e => setCidade(e.target.value)} /></div>

            <h4 style={{ gridColumn: 'span 2', borderBottom: '1px solid #eee', margin: 0, marginTop: '10px' }}>Dados Oftalmológicos</h4>
            <div><label>Médico Responsável</label><input type="text" value={medico} onChange={e => setMedico(e.target.value)} /></div>
            <div><label>Data da Última Consulta</label><input type="date" value={ultimaConsulta} onChange={e => setUltimaConsulta(e.target.value)} /></div>
            
            <div style={{ gridColumn: 'span 2', padding: '15px', background: '#f8f9fa', borderRadius: '5px', overflowX: 'auto' }}>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '10px' }}>Prescrição de Óculos</label>
              <TabelaPrescricao 
                receita={receitaOculos} 
                onChange={(chave: keyof ReceitaOculos, prop: keyof Graus, val: string) => {
                  setReceitaOculos(prev => ({ ...prev, [chave]: { ...prev[chave], [prop]: val } }));
                }} 
              />
            </div>
            
            <div style={{ gridColumn: 'span 2' }}>
              <label>Observações Gerais</label>
              <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} style={{ width: '100%', padding: '10px', minHeight: '60px' }} />
            </div>

            <button type="submit" style={{ gridColumn: 'span 2', padding: '12px', background: '#007bff' }}>💾 Salvar Ficha Completa</button>
          </form>
        </div>
      )}

      <table style={{ marginTop: '20px', width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr style={{background: '#334155', color: 'white'}}><th>Cód</th><th>Nome</th><th>Telefone</th><th className="no-print">Ação</th></tr></thead>
        <tbody>
          {clientes.map(c => (
             <tr key={c.id}>
                <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{formatarCodigo(c.codigo)}</td>
                <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{c.nome}</td>
                <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{c.telefone}</td>
                <td className="no-print" style={{ padding: '10px', borderBottom: '1px solid #eee' }}>
                  <button onClick={() => { 
                    setClienteAtual(c); 
                    setClienteOriginal(JSON.parse(JSON.stringify(c))); 
                    setModoEdicao(false); setModalAberto(true); 
                  }} style={{background: '#17a2b8', fontSize: '12px', padding: '5px 10px', color: 'white'}}>Abrir Prontuário</button>
                </td>
             </tr>
          ))}
        </tbody>
      </table>

      {modalAberto && clienteAtual && (
        <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, paddingTop: '20px' }}>
          <div className="card-formulario" style={{ width: '750px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h2 style={{ margin: 0, color: '#1e293b' }}>Prontuário: {clienteAtual.nome}</h2>
              <button onClick={() => setModoEdicao(!modoEdicao)} style={{ background: modoEdicao ? '#6c757d' : '#ffc107', color: 'white' }}>
                {modoEdicao ? 'Cancelar Edição' : '✏️ Editar Ficha / Nova Prescrição'}
              </button>
            </div>

            {modoEdicao ? (
              <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: '1fr 1fr' }}>
                <h4 style={{ gridColumn: 'span 2', margin: 0, borderBottom: '1px solid #eee' }}>Dados Pessoais & Endereço</h4>
                <div><label>Nome</label><input value={clienteAtual.nome} onChange={e => setClienteAtual({...clienteAtual, nome: e.target.value})} /></div>
                <div><label>Telefone</label><input value={clienteAtual.telefone} onChange={e => setClienteAtual({...clienteAtual, telefone: formatarTelefone(e.target.value)})} /></div>
                <div><label>CPF</label><input value={clienteAtual.cpf} onChange={e => setClienteAtual({...clienteAtual, cpf: formatarCPF(e.target.value)})} /></div>
                <div><label>Nascimento</label><input type="date" value={clienteAtual.dataNascimento || ''} onChange={e => setClienteAtual({...clienteAtual, dataNascimento: e.target.value})} /></div>
                <div style={{ gridColumn: 'span 2' }}><label>Logradouro</label><input value={clienteAtual.endereco?.logradouro || ''} onChange={e => setClienteAtual({...clienteAtual, endereco: {...clienteAtual.endereco, logradouro: e.target.value}})} /></div>
                <div><label>Número</label><input value={clienteAtual.endereco?.numero || ''} onChange={e => setClienteAtual({...clienteAtual, endereco: {...clienteAtual.endereco, numero: e.target.value}})} /></div>
                <div><label>Cidade</label><input value={clienteAtual.endereco?.cidade || ''} onChange={e => setClienteAtual({...clienteAtual, endereco: {...clienteAtual.endereco, cidade: e.target.value}})} /></div>

                <h4 style={{ gridColumn: 'span 2', margin: '15px 0 0 0', borderBottom: '1px solid #eee', color: '#007bff' }}>Nova Prescrição de Óculos</h4>
                <div style={{ gridColumn: 'span 2', background: '#eef2f5', padding: '10px', borderRadius: '5px', fontSize: '12px' }}>
                  ℹ️ <em>Altere os dados abaixo para gerar uma nova receita. A prescrição anterior será arquivada no histórico de evolução automaticamente.</em>
                </div>
                <div><label>Médico Solicitante</label><input value={clienteAtual.dadosClinicos?.medico || ''} onChange={e => setClienteAtual({...clienteAtual, dadosClinicos: {...clienteAtual.dadosClinicos, medico: e.target.value}})} /></div>
                <div><label>Data da Consulta</label><input type="date" value={clienteAtual.dadosClinicos?.ultimaConsulta || ''} onChange={e => setClienteAtual({...clienteAtual, dadosClinicos: {...clienteAtual.dadosClinicos, ultimaConsulta: e.target.value}})} /></div>
                
                <div style={{ gridColumn: 'span 2', overflowX: 'auto' }}>
                  <TabelaPrescricao 
                    receita={clienteAtual.dadosClinicos?.receitaOculos || receitaVazia} 
                    onChange={(chave: keyof ReceitaOculos, prop: keyof Graus, val: string) => {
                      const clinicos = clienteAtual.dadosClinicos || {};
                      const recAtual = clinicos.receitaOculos || receitaVazia;
                      setClienteAtual({ ...clienteAtual, dadosClinicos: { ...clinicos, receitaOculos: { ...recAtual, [chave]: { ...recAtual[chave], [prop]: val } } } });
                    }} 
                  />
                </div>

                <div style={{ gridColumn: 'span 2' }}><label>Observações Médicas/Montagem</label><textarea value={clienteAtual.dadosClinicos?.observacoes || ''} onChange={e => setClienteAtual({...clienteAtual, dadosClinicos: {...clienteAtual.dadosClinicos, observacoes: e.target.value}})} style={{ width: '100%', padding: '10px' }} /></div>
                <button onClick={salvarEdicao} style={{ gridColumn: 'span 2', background: '#28a745', marginTop: '10px', color: 'white' }}>💾 Salvar Alterações e Gerar Evolução</button>
              </div>
            ) : (
              <>
                <p><strong>Telefone:</strong> {clienteAtual.telefone} | <strong>CPF:</strong> {clienteAtual.cpf}</p>
                <p><strong>Endereço:</strong> {clienteAtual.endereco?.logradouro}, {clienteAtual.endereco?.numero} - {clienteAtual.endereco?.bairro}, {clienteAtual.endereco?.cidade}</p>
                <hr style={{ margin: '20px 0', border: '0.5px solid #e2e8f0' }}/>
                
                <h3 style={{ color: '#007bff' }}>Prescrição Atual</h3>
                <p><strong>Médico:</strong> {clienteAtual.dadosClinicos?.medico || 'Não informado'} | <strong>Consulta:</strong> {clienteAtual.dadosClinicos?.ultimaConsulta ? clienteAtual.dadosClinicos.ultimaConsulta.split('-').reverse().join('/') : 'Não informada'}</p>
                
                {clienteAtual.dadosClinicos?.receitaOculos ? (
                  <div style={{ overflowX: 'auto' }}>
                    <TabelaPrescricao receita={clienteAtual.dadosClinicos.receitaOculos} modoLeitura={true} />
                  </div>
                ) : (
                  <p style={{ color: '#666', fontStyle: 'italic' }}>Este cliente utiliza o formato de receita antigo. Atualize a ficha para ver a nova matriz.</p>
                )}
                
                <p style={{ marginTop: '10px' }}><strong>Obs:</strong> {clienteAtual.dadosClinicos?.observacoes || 'Nenhuma observação.'}</p>

                {clienteAtual.dadosClinicos?.historicoEvolucao?.length > 0 && (
                  <div style={{ marginTop: '30px', padding: '20px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px' }}>
                    <h3 style={{ margin: '0 0 15px 0', color: '#d97706' }}>⏳ Histórico de Receitas Anteriores</h3>
                    
                    {clienteAtual.dadosClinicos.historicoEvolucao.map((hist: any, i: number) => (
                      <div key={i} style={{ marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px dashed #d97706' }}>
                        <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#92400e', fontWeight: 'bold' }}>📅 Arquivado em: {new Date(hist.dataAlteracao).toLocaleDateString('pt-BR')} às {new Date(hist.dataAlteracao).toLocaleTimeString('pt-BR')}</p>
                        <p style={{ margin: '0 0 10px 0', fontSize: '13px' }}><strong>Médico:</strong> {hist.medico || 'N/A'} | <strong>Consulta:</strong> {hist.ultimaConsulta ? hist.ultimaConsulta.split('-').reverse().join('/') : 'N/A'}</p>
                        
                        {hist.receitaOculos ? (
                          <div style={{ opacity: 0.8 }}><TabelaPrescricao receita={hist.receitaOculos} modoLeitura={true} /></div>
                        ) : hist.receitas?.length > 0 ? (
                          <p style={{ fontSize: '12px', color: 'gray' }}>[Receita no formato antigo salva. Edite a ficha atual para atualizar o histórico no novo padrão].</p>
                        ) : null}
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
    </div>
  );
}
