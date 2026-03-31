import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, getDocs, doc, updateDoc } from 'firebase/firestore';
import { formatarCNPJ, formatarTelefone } from '../utils/mascaras';

export default function Fornecedores() {
  const [fornecedores, setFornecedores] = useState<any[]>([]);
  
  const [nome, setNome] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  
  // Endereço
  const [rua, setRua] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');

  // Modal
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
      nome, cnpj, telefone, email,
      endereco: { rua, numero, complemento, bairro, cidade, uf }
    });
    alert('Fornecedor cadastrado!');
    carregarDados();
  };

  const salvarEdicao = async () => {
    try {
      await updateDoc(doc(db, 'fornecedores', fornAtual.id), { ...fornAtual });
      alert('Fornecedor atualizado!');
      setModoEdicao(false);
      carregarDados();
    } catch (error) {
      alert('Erro ao atualizar.');
    }
  };

  return (
    <div>
      <h2>🤝 Controle de Fornecedores</h2>
      <div className="card-formulario">
        <form onSubmit={cadastrarFornecedor} style={{ display: 'grid', gap: '15px', gridTemplateColumns: '1fr 1fr' }}>
          <div><label style={{fontSize:'12px', fontWeight:'bold'}}>Razão Social / Nome</label><input type="text" value={nome} onChange={e => setNome(e.target.value)} required /></div>
          <div><label style={{fontSize:'12px', fontWeight:'bold'}}>CNPJ</label><input type="text" value={cnpj} onChange={e => setCnpj(formatarCNPJ(e.target.value))} required maxLength={18} /></div>
          <div><label style={{fontSize:'12px', fontWeight:'bold'}}>Telefone / WhatsApp</label><input type="text" value={telefone} onChange={e => setTelefone(formatarTelefone(e.target.value))} required maxLength={15} /></div>
          <div><label style={{fontSize:'12px', fontWeight:'bold'}}>E-mail Comercial</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
          
          <h4 style={{ gridColumn: 'span 2', margin: 0, borderBottom: '1px solid #eee' }}>Endereço do Fornecedor</h4>
          <div><label style={{fontSize:'12px', fontWeight:'bold'}}>Logradouro (Rua/Av)</label><input type="text" value={rua} onChange={e => setRua(e.target.value)} /></div>
          <div><label style={{fontSize:'12px', fontWeight:'bold'}}>Número</label><input type="text" value={numero} onChange={e => setNumero(e.target.value)} /></div>
          <div><label style={{fontSize:'12px', fontWeight:'bold'}}>Complemento</label><input type="text" value={complemento} onChange={e => setComplemento(e.target.value)} /></div>
          <div><label style={{fontSize:'12px', fontWeight:'bold'}}>Bairro</label><input type="text" value={bairro} onChange={e => setBairro(e.target.value)} /></div>
          <div><label style={{fontSize:'12px', fontWeight:'bold'}}>Cidade</label><input type="text" value={cidade} onChange={e => setCidade(e.target.value)} /></div>
          <div>
            <label style={{fontSize:'12px', fontWeight:'bold'}}>Estado (UF)</label>
            <select value={uf} onChange={e => setUf(e.target.value)}>
              <option value="">Selecione...</option>
              {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(estado => <option key={estado} value={estado}>{estado}</option>)}
            </select>
          </div>
          <button type="submit" style={{ gridColumn: 'span 2' }}>Cadastrar Fornecedor</button>
        </form>
      </div>

      <table style={{ marginTop: '20px' }}>
        <thead><tr><th>Fornecedor</th><th>CNPJ</th><th>Telefone</th><th>Ação</th></tr></thead>
        <tbody>
          {fornecedores.map(f => (
            <tr key={f.id}>
              <td>{f.nome}</td><td>{f.cnpj}</td><td>{f.telefone}</td>
              <td><button onClick={() => { setFornAtual(f); setModoEdicao(false); setModalAberto(true); }}>Ver / Editar</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* MODAL DE FORNECEDORES (Edição e Visualização) */}
      {modalAberto && fornAtual && (
         <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card-formulario" style={{ width: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0 }}>{fornAtual.nome}</h3>
              <button onClick={() => setModoEdicao(!modoEdicao)} style={{ background: modoEdicao ? '#6c757d' : '#ffc107', color: 'black' }}>
                {modoEdicao ? 'Cancelar Edição' : '✏️ Editar'}
              </button>
            </div>

            {modoEdicao ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input value={fornAtual.nome} onChange={e => setFornAtual({...fornAtual, nome: e.target.value})} placeholder="Nome" />
                <input value={fornAtual.telefone} onChange={e => setFornAtual({...fornAtual, telefone: formatarTelefone(e.target.value)})} placeholder="Telefone" />
                <input value={fornAtual.endereco?.cidade || ''} onChange={e => setFornAtual({...fornAtual, endereco: {...fornAtual.endereco, cidade: e.target.value}})} placeholder="Cidade" />
                <button onClick={salvarEdicao} style={{ background: '#28a745' }}>💾 Confirmar Alterações</button>
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
