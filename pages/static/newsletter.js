import React from 'react';
import Head from 'next/head';
import Topbar from '../../src/components/Topbar';
import Header from '../../src/components/Header';
import SiteFooter from '../../src/components/SiteFooter';

export default function Staticnewsletter() {
	return (
		<>
			<Head>
				<title>Newsletter — Cointist</title>
				<meta name="description" content="Subscribe to the Cointist newsletter for curated crypto news, analysis, and timely market insights delivered to your inbox." />
			</Head>
		</>
	);
}
// Thin wrapper to ensure the newsletter page module is emitted reliably during build
export { default } from './newsletter.jsx';
