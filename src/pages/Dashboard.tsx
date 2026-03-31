import { useAuth } from '../contexts/AuthContext';
import { auth, db } from '../firebase';
import { signOut, updatePassword } from 'firebase/auth';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';

export default function Dashboard() {
  const { user } = useAuth();
  const location = useLocation(); 
  
  const [vendasHoje, setVendasHoje] = useState(0);
  const [estoqueBaixo, setEstoqueBaixo] = useState(0);

  // Estados do Modal de Perfil
  const [modalPerfil, setModalPerfil] = useState(false);
  const [perfilNome, setPerfilNome] = useState('');
  const [perfilCpf, setPerfilCpf] = useState('');
  const [perfilNascimento, setPerfilNascimento] = useState('');
  const [perfilTelefone, setPerfilTelefone] = useState('');
  const [perfilEndereco, setPerfilEndereco] = useState('');
  const [novaSenha, setNovaSenha] = useState('');

  useEffect(() => {
    const carregarIndicadores = async () => {
      if (user?.cargo !== 'admin') return;
      const hoje = new Date().toISOString().split('T')[0];
      
      const vendasSnap = await getDocs(collection(db, 'vendas'));
      let totalVendidoHoje = 0;
      vendasSnap.forEach(doc => {
        if (doc.data().dataVenda === hoje) totalVendidoHoje += doc.data().valorTotal;
      });
      setVendasHoje(totalVendidoHoje);

      const estoqueSnap = await getDocs(collection(db, 'estoque'));
      let itensBaixos = 0;
      estoqueSnap.forEach(doc => {
        if (doc.data().quantidade <= 3) itensBaixos++;
      });
      setEstoqueBaixo(itensBaixos);
    };
    carregarIndicadores();
  }, [user]);

  const abrirPerfil = () => {
    setPerfilNome(user?.nome || '');
    setModalPerfil(true);
  };

  const salvarPerfil = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (user?.uid) {
        await updateDoc(doc(db, 'colaboradores', user.uid), {
          nome: perfilNome, cpf: perfilCpf, dataNascimento: perfilNascimento, 
          telefone: perfilTelefone, endereco: perfilEndereco
        });
      }
      if (novaSenha && auth.currentUser) {
        await updatePassword(auth.currentUser, novaSenha);
        alert('Senha atualizada com sucesso!');
      }
      alert('Perfil atualizado!');
      setModalPerfil(false);
    } catch (error) {
      alert('Erro ao atualizar perfil. Tente fazer login novamente para trocar a senha.');
    }
  };

  const handleLogout = async () => { await signOut(auth); };

  const linkAtivo = (caminho: string) => location.pathname === caminho ? '#007bff' : 'transparent';
  const corTextoLink = (caminho: string) => location.pathname === caminho ? 'white' : '#b8c2cc';

  return (
    <div style={{ display: 'flex', flexDirection: 'row', height: '100vh', width: '100vw', overflow: 'hidden', fontFamily: 'sans-serif' }}>
      
      {/* MENU LATERAL */}
      <nav style={{ width: '250px', flexShrink: 0, backgroundColor: '#1e293b', color: 'white', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px', textAlign: 'center', borderBottom: '1px solid #334155', backgroundColor: 'white' }}>
          <img src="/logo.png" alt="Ótica Milenium" style={{ maxWidth: '180px', maxHeight: '60px' }} />
        </div>

        <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
          <p style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>Menu Principal</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <li><Link to="/" style={{ display: 'block', padding: '12px 15px', textDecoration: 'none', borderRadius: '6px', backgroundColor: linkAtivo('/'), color: corTextoLink('/'), transition: 'all 0.2s' }}>🏠 Início (Dashboard)</Link></li>
            <li><Link to="/clientes" style={{ display: 'block', padding: '12px 15px', textDecoration: 'none', borderRadius: '6px', backgroundColor: linkAtivo('/clientes'), color: corTextoLink('/clientes') }}>👥 Clientes</Link></li>
            <li><Link to="/vendas" style={{ display: 'block', padding: '12px 15px', textDecoration: 'none', borderRadius: '6px', backgroundColor: linkAtivo('/vendas'), color: corTextoLink('/vendas') }}>💰 PDV (Vendas)</Link></li>
            <li><Link to="/estoque" style={{ display: 'block', padding: '12px 15px', textDecoration: 'none', borderRadius: '6px', backgroundColor: linkAtivo('/estoque'), color: corTextoLink('/estoque') }}>📦 Estoque</Link></li>
            <li><Link to="/fornecedores" style={{ display: 'block', padding: '12px 15px', textDecoration: 'none', borderRadius: '6px', backgroundColor: linkAtivo('/fornecedores'), color: corTextoLink('/fornecedores') }}>🤝 Fornecedores</Link></li>
            
            {user?.cargo === 'admin' && (
              <>
                <p style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '20px', marginBottom: '10px' }}>Gestão & Financeiro</p>
                <li><Link to="/receber" style={{ display: 'block', padding: '12px 15px', textDecoration: 'none', borderRadius: '6px', backgroundColor: linkAtivo('/receber'), color: corTextoLink('/receber') }}>💸 Contas a Receber</Link></li>
                <li><Link to="/relatorios" style={{ display: 'block', padding: '12px 15px', textDecoration: 'none', borderRadius: '6px', backgroundColor: linkAtivo('/relatorios'), color: corTextoLink('/relatorios') }}>📊 Relatórios</Link></li>
              </>
            )}
          </ul>
        </div>

        {/* RODAPÉ DO MENU */}
        <div style={{ padding: '15px', borderTop: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div onClick={abrirPerfil} style={{ fontSize: '14px', cursor: 'pointer', flex: 1 }} title="Clique para editar seu perfil">
            <span style={{ display: 'block', fontWeight: 'bold' }}>{user?.nome} ⚙️</span>
            <span style={{ color: '#94a3b8', fontSize: '12px' }}>{user?.cargo}</span>
          </div>
          <button onClick={handleLogout} style={{ backgroundColor: 'transparent', color: '#ef4444', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Sair</button>
        </div>
      </nav>

      <main style={{ flex: 1, padding: '30px', overflowY: 'auto', backgroundColor: '#f8fafc', boxSizing: 'border-box' }}>
        {window.location.pathname === '/' && user?.cargo === 'admin' && (
          <div style={{ marginBottom: '30px' }}>
            <h2 style={{ marginTop: 0, color: '#1e293b' }}>Painel de Controle</h2>
            <div style={{ display: 'flex', gap: '20px' }}>
              <div style={{ flex: 1, padding: '25px', backgroundColor: 'white', borderRadius: '10px', borderLeft: '5px solid #10b981' }}>
                <p style={{ margin: 0, color: '#64748b', fontWeight: 'bold' }}>Vendido Hoje</p>
                <h2 style={{ margin: '10px 0 0 0' }}>{vendasHoje.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</h2>
              </div>
              <div style={{ flex: 1, padding: '25px', backgroundColor: 'white', borderRadius: '10px', borderLeft: '5px solid #ef4444' }}>
                <p style={{ margin: 0, color: '#64748b', fontWeight: 'bold' }}>Alertas de Estoque</p>
                <h2 style={{ margin: '10px 0 0 0' }}>{estoqueBaixo} produtos acabando</h2>
              </div>
            </div>
          </div>
        )}
        <Outlet />
      </main>

      {/* MODAL DE PERFIL */}
      {modalPerfil && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card-formulario" style={{ width: '500px' }}>
            <h2>Meu Perfil</h2>
            <form onSubmit={salvarPerfil} style={{ display: 'grid', gap: '10px', gridTemplateColumns: '1fr 1fr' }}>
              <input type="text" placeholder="Nome Completo" value={perfilNome} onChange={e => setPerfilNome(e.target.value)} style={{ gridColumn: 'span 2' }} />
              <input type="text" placeholder="CPF" value={perfilCpf} onChange={e => setPerfilCpf(e.target.value)} />
              <input type="date" title="Data de Nascimento" value={perfilNascimento} onChange={e => setPerfilNascimento(e.target.value)} />
              <input type="text" placeholder="Telefone" value={perfilTelefone} onChange={e => setPerfilTelefone(e.target.value)} />
              <input type="password" placeholder="Nova Senha (opcional)" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} />
              <input type="text" placeholder="Endereço Completo" value={perfilEndereco} onChange={e => setPerfilEndereco(e.target.value)} style={{ gridColumn: 'span 2' }} />
              
              <div style={{ gridColumn: 'span 2', display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="submit" style={{ flex: 1, background: '#007bff' }}>Salvar Alterações</button>
                <button type="button" onClick={() => setModalPerfil(false)} style={{ background: '#dc3545', color: 'white', padding: '10px' }}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
