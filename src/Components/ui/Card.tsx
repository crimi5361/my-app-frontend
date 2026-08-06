import { CSSProperties, ReactNode } from "react";
import { Card as AntCard } from "antd";

interface CardProps {
  title?: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
  bodyStyle?: CSSProperties;
}

// Fine surcouche d'antd Card : n'ajoute qu'une ombre/bordure cohérentes avec
// les jetons (mêmes valeurs que Hub.css) — aucune logique, juste le style de
// référence pour toute nouvelle carte de contenu.
const Card = ({ title, extra, children, style, bodyStyle }: CardProps) => (
  <AntCard
    title={title}
    extra={extra}
    style={{
      borderColor: "var(--border)",
      boxShadow: "var(--shadow)",
      ...style,
    }}
    styles={{ body: { padding: 20, ...bodyStyle } }}
  >
    {children}
  </AntCard>
);

export default Card;
