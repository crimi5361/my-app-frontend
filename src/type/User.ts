export interface User {
  id: number;
  nom: string;
  email: string;
  statut: 'active' | 'desactive';
  role: string;
  departementName: string;
}
