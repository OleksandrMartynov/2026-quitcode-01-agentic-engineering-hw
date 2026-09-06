import { PButton, PHeading, PText } from '@porsche-design-system/components-react';

export default function App() {
  return (
    <main className="app">
      <PHeading size="xl" tag="h1">
        Tic-Tac-Toe Lab
      </PHeading>
      <PText color="contrast-high">Porsche Design System is wired up.</PText>
      <div className="row">
        <PButton type="button" icon="grid">
          New game
        </PButton>
      </div>
    </main>
  );
}
