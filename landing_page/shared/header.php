<?php
header('Cache-Control: no-cache, must-revalidate');
// All page metadata is authored in the repository; no request values enter templates.
function escape(string $value): string { return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
?><!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title><?= escape($title) ?> | LiquidNAT</title><meta name="description" content="<?= escape($description) ?>">
<meta name="theme-color" content="#1239ed"><meta property="og:title" content="<?= escape($title) ?> | LiquidNAT"><meta property="og:description" content="<?= escape($description) ?>"><meta property="og:type" content="website">
<link rel="canonical" href="https://liquidnat.com/<?= $page === 'index.php' ? '' : escape($page) ?>">
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="assets/site.css"><script src="assets/site.js" defer></script></head>
<body id="top" data-contact-email="hello@liquidnat.com">
<?php
$navigation = <<<'NAV'
<a class="skip" href="#main">Skip to content</a>
<div class="announcement"><span class="pulse"></span> A new chapter. LiquidNAT is now part of LiquidWebSpace LTD. <a href="news.php">Meet the next era ↗</a></div>
<header><div class="nav-wrap"><a class="brand" href="index.php" aria-label="LiquidNAT home"><span class="brand-icon">≋</span>Liquid<b>NAT</b><small>BY LIQUIDWEBSPACE</small></a><button class="menu-toggle" aria-expanded="false" aria-controls="navigation">Menu ☰</button><nav id="navigation" aria-label="Main navigation"><div class="dropdown"><button class="drop-toggle" aria-expanded="false">Platform ⌄</button><div class="drop-panel"><a href="platform.php">The platform <small>One connected network stack</small></a><a href="cgnat.php">CGNAT & addressing <small>Shared, direct and static IPv4</small></a><a href="gateway.php">LiquidNAT Gateway <small>Broadband edge & CGNAT</small></a><a href="radius.php">LiquidNAT RADIUS <small>Identity & service policy</small></a><a href="manager.php">LiquidNAT Manager <small>Your network, in focus</small></a></div></div><a href="solutions.php">Solutions</a><a href="compare.php">Compare</a><a href="resources.php">Resources</a><a href="about.php">About</a><a class="nav-cta" href="contact.php">Let’s talk ↗</a></nav></div></header>
NAV;
echo str_replace('href="' . $page . '"', 'href="' . $page . '" aria-current="page"', $navigation);
?><main id="main">
