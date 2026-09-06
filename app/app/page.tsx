import { PHeading, PText } from '@porsche-design-system/components-react/ssr';

export default function Home() {
  return (
    <main className="app">
      <PHeading size="xl" tag="h1">
        Tic-Tac-Toe Lab
      </PHeading>
      <PText color="contrast-high">Porsche Design System is wired up.</PText>
    </main>
  );
}
