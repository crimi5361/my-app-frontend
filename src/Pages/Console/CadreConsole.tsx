// Le cadre des deux écrans de la console (2026-08-26).
//
// POURQUOI CETTE CONSOLE SORT DU TABLEAU DE BORD. Elle ne gère qu'une chose :
// l'assistante. Rendue dans le cadre habituel de l'ERP, elle s'entourait du menu
// latéral des inscriptions, des paiements, du stock — vingt portes vers autre
// chose autour d'un écran qui n'a qu'un sujet. On entre ici pour l'assistante,
// on en sort par la seule porte qui compte : le retour au hub.
//
// C'est le même parti que l'espace étudiant et l'écran vocal, et pour la même
// raison : un espace qui a son propre objet mérite son propre cadre.
//
// LES DEUX ÉCRANS RESTENT DEUX. On ne les a pas fondus en un seul : « la santé
// des services » et « ce que l'assistante peut lire » répondent à deux questions
// qu'on ne se pose pas en même temps. Ils se citent l'un l'autre ici, dans
// l'en-tête, pour que le second ne soit pas un écran qu'on n'ouvre jamais.
import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Radio, Typography, Space } from 'antd';
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';
import './Console.css';

const { Title, Text } = Typography;

interface Props {
  courant: 'sante' | 'donnees';
  /** Horodatage de la mesure affichée, déjà mis en forme. */
  fraicheur?: string | null;
  onRafraichir: () => void;
  chargement?: boolean;
  /** Intitulé du bouton de rafraîchissement : on ne « vérifie » pas une couverture. */
  libelleRafraichir: string;
  children: ReactNode;
}

export default function CadreConsole({
  courant, fraicheur, onRafraichir, chargement, libelleRafraichir, children,
}: Props) {
  const naviguer = useNavigate();

  return (
    <div className="console-cadre">
      <header className="console-barre">
        <Space size={16} wrap>
          {/* La sortie est à gauche et toujours au même endroit : c'est le seul
              chemin hors de cette console, puisqu'il n'y a plus de menu. */}
          <Button icon={<ArrowLeftOutlined />} onClick={() => naviguer('/hub')} type="text">
            Retour
          </Button>
          <Title level={5} className="console-titre">Console de l'assistante</Title>
        </Space>

        <Space size={12} wrap>
          <Radio.Group
            value={courant}
            size="small"
            onChange={(e) => naviguer(
              e.target.value === 'sante' ? '/console-assistant' : '/console-assistant/donnees',
            )}
          >
            <Radio.Button value="sante">Santé</Radio.Button>
            <Radio.Button value="donnees">Ce qu'elle peut lire</Radio.Button>
          </Radio.Group>

          {fraicheur && <Text className="console-fraicheur">mesuré à {fraicheur}</Text>}

          <Button icon={<ReloadOutlined />} onClick={onRafraichir} loading={chargement}>
            {libelleRafraichir}
          </Button>
        </Space>
      </header>

      <main className="console-contenu">{children}</main>
    </div>
  );
}
