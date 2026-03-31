import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, doc, updateDoc } from 'firebase/firestore';
import { obterProximoCodigo, formatarCodigo } from '../utils/geradores';
import { formatarCPF, formatarTelefone, formatarGrau } from '../utils/mascaras';

interface Receita { tipo: string; od: string; oe: string; }

export default function Clientes() {
  const [clientes, setClientes] = useState<any[]>([]);
  
  // Campos Básicos
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [telefone, setTelefone] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  
  // Endereço
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');

  // Dados Clínicos
  const [medico, setMedico] = useState('');
  const [ultimaConsulta, setUltimaConsulta] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [receitas, setReceitas] = useState<Receita[]>([{ tipo: '', od: '', oe: '' }]);

  // Modal e Edição
  const [modalAberto, setModalAberto] = useState(false);
  const [clienteAtual, setClienteAtual] = useState<any>(null);
  const [modoEdicao, setModoEdicao] = useState(false);

  const buscarClientes = async () => {
    const snap = await getDocs(collection(db, 'clientes'));
    setClientes(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a:any, b:any) => b.codigo - a.codigo));
  };

  useEffect(() => { buscarClientes(); }, []);

  const adicionarLinhaReceita = () => setReceitas([...receitas, { tipo: '', od: '', oe: '' }]);
  const atualizarReceita = (index: number, campo: keyof Receita, valor: string) => {
    const novasReceitas = [...receitas];
    novasReceitas[index][campo] = valor;
    setReceitas(novasReceitas);
  };

  const cadastrarCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    const codigoSeq = await obterProximoCodigo('clientes');
    
    await addDoc(collection(db, 'clientes'), {
      codigo: codigoSeq, nome, cpf, telefone, dataNascimento,
      endereco: { logradouro, numero, complemento, bairro, cidade },
      dadosClinicos: { medico, ultimaConsulta, observacoes, receitas }
    });
    alert('Ficha cadastrada com sucesso!');
    buscarClientes();
    // Limpar os campos omitido para focar na lógica...
  };

  const salvarEdicao = async () => {
    try {
      const clienteRef = doc(db, 'clientes', clienteAtual.id);
      await updateDoc(clienteRef, { ...clienteAtual }); // Salva o estado modificado
      alert('Alterações salvas!');
      setModoEdicao(false);
      buscarClientes();
    } catch (error) {
      alert('Erro ao salvar edições.');
    }
  };

  return (
    <div>
      <h2>👥 Clientes & Fichas Clínicas</h2>
      <div className="card-formulario">
        <form onSubmit={cadastrarCliente} style={{ display: 'grid', gap: '15px', gridTemplateColumns: '1fr 1fr' }}>
          
          <h4 style={{ gridColumn: 'span 2', borderBottom: '1px solid #eee', margin: 0 }}>Dados Pessoais</h4>
          <div><label style={{fontWeight:'bold', fontSize:'12px'}}>Nome Completo</label><input type="text" value={nome} onChange={e => setNome(e.target.value)} required /></div>
          <div><label style={{fontWeight:'bold', fontSize:'12px'}}>Celular / Telefone</label><input type="text" value={telefone} onChange={e => setTelefone(formatarTelefone(e.target.value))} required maxLength={15} /></div>
          <div><label style={{fontWeight:'bold', fontSize:'12px'}}>CPF</label><input type="text" value={cpf} onChange={e => setCpf(formatarCPF(e.target.value))} maxLength={14} /></div>
          <div><label style={{fontWeight:'bold', fontSize:'12px'}}>Data de Nascimento</label><input type="date" value={dataNascimento} onChange={e => setDataNascimento(e.target.value)} /></div>

          <h4 style={{ gridColumn: 'span 2', borderBottom: '1px solid #eee', margin: 0, marginTop: '10px' }}>Endereço</h4>
          <div style={{ gridColumn: 'span 2' }}><label style={{fontWeight:'bold', fontSize:'12px'}}>Logradouro (Rua/Av)</label><input type="text" value={logradouro} onChange={e => setLogradouro(e.target.value)} /></div>
          <div><label style={{fontWeight:'bold', fontSize:'12px'}}>Número</label><input type="text" value={numero} onChange={e => setNumero(e.target.value)} /></div>
          <div><label style={{fontWeight:'bold', fontSize:'12px'}}>Complemento</label><input type="text" value={complemento} onChange={e => setComplemento(e.target.value)} /></div>
          <div><label style={{fontWeight:'bold', fontSize:'12px'}}>Bairro</label><input type="text" value={bairro} onChange={e => setBairro(e.target.value)} /></div>
          <div><label style={{fontWeight:'bold', fontSize:'12px'}}>Cidade</label><input type="text" value={cidade} onChange={e => setCidade(e.target.value)} /></div>

          <h4 style={{ gridColumn: 'span 2', borderBottom: '1px solid #eee', margin: 0, marginTop: '10px' }}>Dados Oftalmológicos</h4>
          <div><label style={{fontWeight:'bold', fontSize:'12px'}}>Médico Responsável</label><input type="text" value={medico} onChange={e => setMedico(e.target.value)} /></div>
          <div><label style={{fontWeight:'bold', fontSize:'12px'}}>Data da Última Consulta</label><input type="date" value={ultimaConsulta} onChange={e => setUltimaConsulta(e.target.value)} /></div>
          
          <div style={{ gridColumn: 'span 2', padding: '15px', background: '#f8f9fa', borderRadius: '5px' }}>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '10px', fontSize: '12px' }}>Receitas e Graus</label>
            {receitas.map((rec, index) => (
              <div key={index} style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <div style={{ flex: 1 }}><input type="text" placeholder="Doença (Ex: Miopia)" value={rec.tipo} onChange={e => atualizarReceita(index, 'tipo', e.target.value)} /></div>
                <div style={{ width: '120px' }}><input type="text" placeholder="OD" value={rec.od} onChange={e => atualizarReceita(index, 'od', formatarGrau(e.target.value))} title="Apenas números, vírgula, + ou -" /></div>
                <div style={{ width: '120px' }}><input type="text" placeholder="OE" value={rec.oe} onChange={e => atualizarReceita(index, 'oe', formatarGrau(e.target.value))} title="Apenas números, vírgula, + ou -" /></div>
              </div>
            ))}
            <button type="button" onClick={adicionarLinhaReceita} style={{ background: '#17a2b8', color: 'white', padding: '5px 10px', fontSize: '12px' }}>+ Adicionar Grau Extra</button>
          </div>
          
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{fontWeight:'bold', fontSize:'12px'}}>Observações Gerais</label>
            <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '5px', minHeight: '60px', border: '1px solid #ccc' }} />
          </div>

          <button type="submit" style={{ gridColumn: 'span 2', padding: '12px', marginTop: '10px' }}>💾 Salvar Ficha Completa</button>
        </form>
      </div>

      <table style={{ marginTop: '20px' }}>
        <thead><tr><th>Cód</th><th>Nome</th><th>Telefone</th><th>Ação</th></tr></thead>
        <tbody>
          {clientes.map(c => (
             <tr key={c.id}>
                <td>{formatarCodigo(c.codigo)}</td><td>{c.nome}</td><td>{c.telefone}</td>
                <td><button onClick={() => { setClienteAtual(c); setModoEdicao(false); setModalAberto(true); }}>Ver / Editar Ficha</button></td>
             </tr>
          ))}
        </tbody>
      </table>

      {/* MODAL COM MODO DE EDIÇÃO */}
      {modalAberto && clienteAtual && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card-formulario" style={{ width: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h2 style={{ margin: 0 }}>Ficha: {clienteAtual.nome}</h2>
              <button onClick={() => setModoEdicao(!modoEdicao)} style={{ background: modoEdicao ? '#6c757d' : '#ffc107', color: 'black' }}>
                {modoEdicao ? 'Cancelar Edição' : '✏️ Editar Ficha'}
              </button>
            </div>

            {modoEdicao ? (
              <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: '1fr 1fr' }}>
                <div><label>Nome</label><input value={clienteAtual.nome} onChange={e => setClienteAtual({...clienteAtual, nome: e.target.value})} /></div>
                <div><label>Telefone</label><input value={clienteAtual.telefone} onChange={e => setClienteAtual({...clienteAtual, telefone: formatarTelefone(e.target.value)})} /></div>
                <div><label>CPF</label><input value={clienteAtual.cpf} onChange={e => setClienteAtual({...clienteAtual, cpf: formatarCPF(e.target.value)})} /></div>
                <div><label>Logradouro</label><input value={clienteAtual.endereco?.logradouro || ''} onChange={e => setClienteAtual({...clienteAtual, endereco: {...clienteAtual.endereco, logradouro: e.target.value}})} /></div>
                
                <button onClick={salvarEdicao} style={{ gridColumn: 'span 2', background: '#28a745' }}>💾 Confirmar Alterações</button>
              </div>
            ) : (
              <>
                <p><strong>Telefone:</strong> {clienteAtual.telefone} | <strong>CPF:</strong> {clienteAtual.cpf}</p>
                <p><strong>Endereço:</strong> {clienteAtual.endereco?.logradouro}, {clienteAtual.endereco?.numero} - {clienteAtual.endereco?.cidade}</p>
                <hr/>
                <h3>Dados Oftalmológicos</h3>
                <p><strong>Médico:</strong> {clienteAtual.dadosClinicos?.medico} | <strong>Última Consulta:</strong> {clienteAtual.dadosClinicos?.ultimaConsulta?.split('-').reverse().join('/')}</p>
                
                <table style={{ width: '100%', marginBottom: '15px' }}>
                   <thead><tr style={{background: '#eee'}}><th>Doença/Tipo</th><th>OD</th><th>OE</th></tr></thead>
                   <tbody>
                      {clienteAtual.dadosClinicos?.receitas?.map((rec: any, i: number) => (
                        <tr key={i}><td>{rec.tipo}</td><td>{rec.od}</td><td>{rec.oe}</td></tr>
                      ))}
                   </tbody>
                </table>
                <p><strong>Obs:</strong> {clienteAtual.dadosClinicos?.observacoes}</p>
              </>
            )}
            <button onClick={() => setModalAberto(false)} style={{ background: 'red', color: 'white', width: '100%', marginTop: '15px' }}>Fechar Ficha</button>
          </div>
        </div>
      )}
    </div>
  );
}
