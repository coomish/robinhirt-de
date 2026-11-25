/**
 * Veröffentlichungen. Quelle: Semantic Scholar (Autor 40030155) und Google
 * Scholar, Stand 25.11.2026. Einträge ohne gesicherten Ort stehen in TODO.md.
 */
export interface Publikation {
  jahr: number;
  titel: string;
  ort: string;
  autoren: string;
  url?: string;
  art?: 'Dissertation' | 'Zeitschrift' | 'Konferenz';
}

export const publikationen: Publikation[] = [
  {
    jahr: 2024,
    titel: 'Enhancing Fraud Detection in Enterprise Resource Planning Systems through Federated Learning: A Comparative Study',
    ort: 'IEEE International Conference on Big Data',
    autoren: 'Schnepf, Dieterich, Öztürk, Hirt, Scheuermann',
    url: 'https://doi.org/10.1109/BigData62323.2024.10825489',
    art: 'Konferenz',
  },
  {
    jahr: 2025,
    titel: 'Enabling inter-organizational analytics in business networks through meta machine learning',
    ort: 'Information Technology and Management',
    autoren: 'Hirt, Kühl, Martin, Satzger',
    url: 'https://doi.org/10.1007/s10799-023-00399-7',
    art: 'Zeitschrift',
  },
  {
    jahr: 2021,
    titel: 'How to Conduct Rigorous Supervised Machine Learning in Information Systems Research: The Supervised Machine Learning Reportcard',
    ort: 'Communications of the Association for Information Systems',
    autoren: 'Kühl, Hirt, Baier, Schmitz, Satzger',
    url: 'https://doi.org/10.17705/1CAIS.04845',
    art: 'Zeitschrift',
  },
  {
    jahr: 2020,
    titel: 'Sequential Transfer Machine Learning in Networks: Measuring the Impact of Data and Neural Net Similarity on Transferability',
    ort: 'Hawaii International Conference on System Sciences (HICSS)',
    autoren: 'Hirt, Srivastava, Berg, Kühl',
    url: 'https://arxiv.org/abs/2003.13070',
    art: 'Konferenz',
  },
  {
    jahr: 2020,
    titel: 'How to Learn from Others: Transfer Machine Learning with Additive Regression Models to Improve Sales Forecasting',
    ort: 'IEEE Conference on Business Informatics (CBI)',
    autoren: 'Hirt, Kühl, Peker, Satzger',
    url: 'https://doi.org/10.1109/CBI49978.2020.00010',
    art: 'Konferenz',
  },
  {
    jahr: 2020,
    titel: 'A Transfer Machine Learning Matching Algorithm for Source and Target (TL-MAST)',
    ort: 'International Conference on Machine Learning, Optimization, and Data Science (LOD)',
    autoren: 'Peters, Hirt',
    url: 'https://doi.org/10.1007/978-3-030-64580-9_45',
    art: 'Konferenz',
  },
  {
    jahr: 2020,
    titel: 'A network-based transfer learning approach to improve sales forecasting of new products',
    ort: 'European Conference on Information Systems (ECIS)',
    autoren: 'Karb, Kühl, Hirt, Glivici-Cotruta',
    url: 'https://arxiv.org/abs/2005.06978',
    art: 'Konferenz',
  },
  {
    jahr: 2020,
    titel: 'Half-Empty or Half-Full? A Hybrid Approach to Predict Recycling Behavior of Consumers to Increase Reverse Vending Machine Uptime',
    ort: 'International Conference on Exploring Service Science (IESS)',
    autoren: 'Walk, Hirt, Kühl, Hersløv',
    url: 'https://doi.org/10.1007/978-3-030-38724-2_8',
    art: 'Konferenz',
  },
  {
    jahr: 2019,
    titel: 'Supervised Machine Learning in Service Systems: Deriving Insights from Distributed Data',
    ort: 'Dissertation, Karlsruher Institut für Technologie',
    autoren: 'Hirt',
    url: 'https://publikationen.bibliothek.kit.edu/1000099105',
    art: 'Dissertation',
  },
  {
    jahr: 2019,
    titel: 'Cognitive computing for customer profiling: meta classification for gender prediction',
    ort: 'Electronic Markets',
    autoren: 'Hirt, Kühl, Satzger',
    url: 'https://doi.org/10.1007/s12525-019-00336-z',
    art: 'Zeitschrift',
  },
  {
    jahr: 2019,
    titel: 'Machine Learning in Artificial Intelligence: Towards a Common Understanding',
    ort: 'Hawaii International Conference on System Sciences (HICSS)',
    autoren: 'Kühl, Goutier, Hirt, Satzger',
    url: 'https://doi.org/10.24251/HICSS.2019.630',
    art: 'Konferenz',
  },
  {
    jahr: 2019,
    titel: 'Service Systems, Smart Service Systems and Cyber-Physical Systems – What’s the difference? Towards a Unified Terminology',
    ort: 'Internationale Tagung Wirtschaftsinformatik (WI)',
    autoren: 'Martin, Hirt, Kühl',
    art: 'Konferenz',
  },
  {
    jahr: 2018,
    titel: 'Service-Oriented Cognitive Analytics for Smart Service Systems: A Research Agenda',
    ort: 'Hawaii International Conference on System Sciences (HICSS)',
    autoren: 'Hirt, Kühl, Schmitz, Satzger',
    url: 'https://doi.org/10.24251/HICSS.2018.203',
    art: 'Konferenz',
  },
  {
    jahr: 2018,
    titel: 'Cognition in the Era of Smart Service Systems: Inter-organizational Analytics through Meta and Transfer Learning',
    ort: 'International Conference on Information Systems (ICIS)',
    autoren: 'Hirt, Kühl',
    art: 'Konferenz',
  },
  {
    jahr: 2017,
    titel: 'Abbildung kognitiver Fähigkeiten mit Metamodellen',
    ort: 'INFORMATIK 2017, GI-Jahrestagung',
    autoren: 'Hirt, Kühl',
    url: 'https://doi.org/10.18420/in2017_231',
    art: 'Konferenz',
  },
  {
    jahr: 2017,
    titel: 'An end-to-end process model for supervised machine learning classification: from problem to deployment in information systems',
    ort: 'International Conference on Design Science Research in Information Systems and Technology (DESRIST), Research in Progress',
    autoren: 'Hirt, Kühl, Satzger',
    art: 'Konferenz',
  },
];
