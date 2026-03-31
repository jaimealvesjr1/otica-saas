import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, doc, updateDoc } from 'firebase/firestore';
import { formatarCNPJ, formatarTelefone } from '../utils/mascaras';

export default function Fornecedores() {
  const [fornecedores, setFornecedores] = useState<any[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  
  const [nome, setNome] = useState(''); const [cnpj, setCnpj] = useState(''); const [telefone, setTelefone] = useState(''); const [email, setEmail] = useState('');
  const [rua, setRua] = useState(''); const [numero, setNumero] = useState(''); const [complemento, setComplemento] = useState(''); const [bairro, setBairro] = useState(''); const [cidade, setCidade] = useState(''); const [uf, setUf] = useState('');

  const [modalAberto, setModalAberto] = useState(false);
  const [fornAtual, setFornAtual] = useState<any>(null);
  const [modoEdicao, setModoEdicao] = useState(false);

  const carregarDados = async () => {
    const snap = await getDocs(collection(db, 'fornecedores'));
    setFornecedores(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  useEffect(() => { carregarDados(); }, []);

  const cadastrarFornecedor = async (e: React.FormEvent) => {
    e.preventDefault();
    await addDoc(collection(db, 'fornecedores'), {
      nome, cnpj, telefone, email, endereco: { rua, numero, complemento, bairro, cidade, uf }
    });
    alert('Fornecedor cadastrado!');
    setMostrarForm(false);
    setNome(''); setCnpj(''); setTelefone(''); setEmail(''); setRua(''); setNumero(''); setComplemento(''); setBairro(''); setCidade(''); setUf('');
    carregarDados();
  };

  const salvarEdicao = async () => {
    try {
      await updateDoc(doc(db, 'fornecedores', fornAtual.id), { ...fornAtual });
      alert('Fornecedor atualizado!');
      setModoEdicao(false);
      carregarDados();
    } catch (error) { alert('Erro ao atualizar.'); }
  };

  return (
    <div>
      <style>{`@media print { .no-print { display: none !important; } .print-only { display: block !important; } }`}</style>

      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>🤝 Controle de Fornecedores</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => window.print()} style={{ background: '#17a2b8', color: 'white' }}>🖨️ Gerar Relatório</button>
          <button onClick={() => setMostrarForm(!mostrarForm)} style={{ background: mostrarForm ? '#6c757d' : '#28a745', color: 'white' }}>
            {mostrarForm ? 'Cancelar / Fechar' : '+ Novo Fornecedor'}
          </button>
        </div>
      </div>

      <div className="print-only" style={{ display: 'none', textAlign: 'center', marginBottom: '20px' }}>
        <h2>Relatório de Fornecedores - Ótica Milenium</h2><hr/>
      </div>

      {mostrarForm && (
        <div className="card-formulario no-print" style={{ marginBottom: '20px' }}>
          <form onSubmit={cadastrarFornecedor} style={{ display: 'grid', gap: '15px', gridTemplateColumns: '1fr 1fr' }}>
            <div><label>Razão Social / Nome</label><input type="text" value={nome} onChange={e => setNome(e.target.value)} required /></div>
            <div><label>CNPJ</label><input type="text" value={cnpj} onChange={e => setCnpj(formatarCNPJ(e.target.value))} required maxLength={18} /></div>
            <div><label>Telefone / WhatsApp</label><input type="text" value={telefone} onChange={e => setTelefone(formatarTelefone(e.target.value))} required maxLength={15} /></div>
            <div><label>E-mail Comercial</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
            <h4 style={{ gridColumn: 'span 2', margin: 0, borderBottom: '1px solid #eee' }}>Endereço</h4>
            <div><label>Logradouro (Rua/Av)</label><input type="text" value={rua} onChange={e => setRua(e.target.value)} /></div>
            <div><label>Número</label><input type="text" value={numero} onChange={e => setNumero(e.target.value)} /></div>
            <div><label>Complemento</label><input type="text" value={complemento} onChange={e => setComplemento(e.target.value)} /></div>
            <div><label>Bairro</label><input type="text" value={bairro} onChange={e => setBairro(e.target.value)} /></div>
            <div><label>Cidade</label><input type="text" value={cidade} onChange={e => setCidade(e.target.value)} /></div>
            <div>
              <label>Estado (UF)</label>
              <select value={uf} onChange={e => setUf(e.target.value)}>
                <option value="">Selecione...</option>
                {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(estado => <option key={estado} value={estado}>{estado}</option>)}
              </select>
            </div>
            <button type="submit" style={{ gridColumn: 'span 2', background: '#007bff' }}>Cadastrar Fornecedor</button>
          </form>
        </div>
      )}

      <table style={{ marginTop: '20px', width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr style={{ background: '#334155', color: 'white' }}><th>Fornecedor</th><th>CNPJ</th><th>Telefone</th><th className="no-print">Ação</th></tr></thead>
        <tbody>
          {fornecedores.map(f => (
            <tr key={f.id}>
              <td>{f.nome}</td><td>{f.cnpj}</td><td>{f.telefone}</td>
              <td className="no-print"><button onClick={() => { setFornAtual(f); setModoEdicao(false); setModalAberto(true); }} style={{ background: '#17a2b8', fontSize: '12px', padding: '5px 10px', color: 'white' }}>Ver / Editar</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* MODAL FULL EDIÇÃO DE FORNECEDOR */}
      {modalAberto && fornAtual && (
         <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card-formulario" style={{ width: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0 }}>{fornAtual.nome}</h3>
              <button onClick={() => setModoEdicao(!modoEdicao)} style={{ background: modoEdicao ? '#6c757d' : '#ffc107', color: 'white' }}>
                {modoEdicao ? 'Cancelar Edição' : '✏️ Editar'}
              </button>
            </div>
            {modoEdicao ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ gridColumn: 'span 2' }}><label>Nome</label><input value={fornAtual.nome} onChange={e => setFornAtual({...fornAtual, nome: e.target.value})} /></div>
                <div><label>CNPJ</label><input value={fornAtual.cnpj} onChange={e => setFornAtual({...fornAtual, cnpj: formatarCNPJ(e.target.value)})} /></div>
                <div><label>Telefone</label><input value={fornAtual.telefone} onChange={e => setFornAtual({...fornAtual, telefone: formatarTelefone(e.target.value)})} /></div>
                <div style={{ gridColumn: 'span 2' }}><label>E-mail</label><input value={fornAtual.email || ''} onChange={e => setFornAtual({...fornAtual, email: e.target.value})} /></div>
                <div style={{ gridColumn: 'span 2' }}><label>Logradouro/Rua</label><input value={fornAtual.endereco?.rua || ''} onChange={e => setFornAtual({...fornAtual, endereco: {...fornAtual.endereco, rua: e.target.value}})} /></div>
                <div><label>Cidade</label><input value={fornAtual.endereco?.cidade || ''} onChange={e => setFornAtual({...fornAtual, endereco: {...fornAtual.endereco, cidade: e.target.value}})} /></div>
                <div><label>UF</label><input value={fornAtual.endereco?.uf || ''} onChange={e => setFornAtual({...fornAtual, endereco: {...fornAtual.endereco, uf: e.target.value}})} /></div>
                <button onClick={salvarEdicao} style={{ gridColumn: 'span 2', background: '#28a745', marginTop: '10px', color: 'white' }}>💾 Confirmar Alterações</button>
              </div>
            ) : (
              <>
                <p><strong>CNPJ:</strong> {fornAtual.cnpj}</p>
                <p><strong>Telefone:</strong> {fornAtual.telefone} | <strong>E-mail:</strong> {fornAtual.email}</p>
                <hr />
                <p><strong>Endereço:</strong> {fornAtual.endereco?.rua}, {fornAtual.endereco?.numero} - {fornAtual.endereco?.bairro}. {fornAtual.endereco?.cidade}/{fornAtual.endereco?.uf}</p>
              </>
            )}
            <button onClick={() => setModalAberto(false)} style={{ background: 'red', color: 'white', width: '100%', marginTop: '15px' }}>Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
}
