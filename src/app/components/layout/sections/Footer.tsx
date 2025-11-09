import Link from 'next/link';
import styles from '@/styles/Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.simpleFooter}>
      <div className="container">
        <div className={styles.copyrightContainer}>
          <p className={styles.copyrightText}>
            © 2025 Todos os direitos reservados.
            <span className={styles.legalLinks}>
              <Link href="/politica-de-privacidade" className={styles.legalLink}>
                Política de Privacidade
              </Link>
              <Link href="/termos-de-uso" className={styles.legalLink}>
                Termos de Uso
              </Link>
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}