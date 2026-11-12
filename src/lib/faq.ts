/** Dúvidas frequentes: usadas na página inicial (algumas) e em /duvidas (todas). */
export const FAQ: { q: string; a: string; home?: boolean }[] = [
  {
    q: "Preciso criar conta?",
    a: "Não. Quem organiza recebe um link do painel e cada participante recebe um link só seu. Se informar um e-mail, mandamos os links para você guardar.",
    home: true,
  },
  {
    q: "O organizador consegue ver quem tirou quem?",
    a: "Não, a menos que ele marque essa opção ao criar o grupo. Nesse caso, todos os participantes veem um aviso no convite. Sem essa opção, ninguém além de cada pessoa vê o próprio resultado.",
    home: true,
  },
  {
    q: "Dá para impedir que casais ou parentes se tirem?",
    a: "Dá. Coloque as pessoas no mesmo núcleo (por exemplo, \"Casa da Ana\") ou crie regras do tipo \"Ana não tira Caio\". Antes do sorteio, o site confere se as regras permitem uma combinação e explica o que ajustar se não permitirem.",
    home: true,
  },
  {
    q: "Como cada pessoa vê quem tirou?",
    a: "Pelo link individual. Antes de mostrar o nome, o site pede para confirmar que só a pessoa está olhando a tela. Depois dá para esconder o nome de novo.",
  },
  {
    q: "E se alguém perder o link?",
    a: "Se a pessoa cadastrou e-mail, ela mesma pede os links em \"Perdi meu link\". Se não, o organizador reenvia pelo painel.",
  },
  {
    q: "Dá para refazer o sorteio?",
    a: "Sim, enquanto ninguém tiver visto o resultado. Depois que alguém viu, o site avisa que todos vão receber um resultado novo e pede uma confirmação a mais.",
  },
  {
    q: "Quantas pessoas podem participar?",
    a: "De 3 a 200 pessoas por grupo.",
  },
  {
    q: "Quanto custa?",
    a: "Nada. O site é gratuito e não tem anúncios.",
  },
];
