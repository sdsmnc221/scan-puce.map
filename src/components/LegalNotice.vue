<template>
  <div class="legal-content text-left max-w-4xl mx-auto p-6">
    <h1 class="text-2xl font-bold mb-6">Mentions Légales</h1>

    <section class="mb-8">
      <h2 class="text-xl font-semibold mb-4">Éditeur</h2>
      <p>
        Le site scan-puce.antr.tech est une initiative bénévole et non lucrative
        développée pour le groupe Facebook "<a
          href="https://www.facebook.com/groups/1078122210620320"
          target="_blank"
          class="text-blue-600 hover:underline"
          >Réseau lecteur de puce France</a
        >".
      </p>

      <div class="mt-4">
        <strong>Responsable de publication :</strong><br />
        Thi Van An TRUONG<br />
        Draveil 91210 France<br />
        Contact : reseau.scanpuce@gmail.com |
        <a
          href="https://www.facebook.com/groups/1078122210620320"
          target="_blank"
          class="text-blue-600 hover:underline"
          >Réseau lecteur de puce France</a
        >
      </div>
    </section>

    <section class="mb-8">
      <h2 class="text-xl font-semibold mb-4">Hébergement</h2>
      <ul>
        <li>Hostinger France</li>
        <li>Déployé via Vercel</li>
      </ul>
    </section>

    <h1 class="text-2xl font-bold mb-6">Politique de Confidentialité</h1>

    <section class="mb-8">
      <h2 class="text-xl font-semibold mb-4">
        1. Collecte et Traitement des Données
      </h2>

      <h3 class="text-lg font-medium mb-2">1.1 Données Collectées</h3>
      <ul class="list-disc pl-6 mb-4">
        <li>Données analytiques via Vercel Analytics (version lite)</li>
        <li>
          Informations fournies volontairement via les formulaires d'inscription
          :
          <ul class="list-disc pl-6">
            <li>Localisation du lecteur de puce</li>
            <li>Coordonnées de contact (selon consentement)</li>
          </ul>
        </li>
      </ul>

      <h3 class="text-lg font-medium mb-2">1.2 Finalité du Traitement</h3>
      <ul class="list-disc pl-6 mb-4">
        <li>Cartographie des lecteurs de puce disponibles en France</li>
        <li>
          Mise en relation des utilisateurs avec les détenteurs de lecteurs de
          puce
        </li>
        <li>
          Gestion et mise à jour des informations sur la carte interactive
        </li>
      </ul>

      <h3 class="text-lg font-medium mb-2">1.3 Base Légale</h3>
      <p>Le traitement est basé sur :</p>
      <ul class="list-disc pl-6">
        <li>Le consentement explicite des participants</li>
        <li>
          L'intérêt légitime de fournir un service d'utilité publique non
          lucratif
        </li>
      </ul>
    </section>

    <section class="mb-8">
      <h2 class="text-xl font-semibold mb-4">2. Stockage et Sécurité</h2>

      <h3 class="text-lg font-medium mb-2">2.1 Stockage</h3>
      <p>
        Les données sont stockées dans une base de données Airtable, gérée et
        modérée via reseau.scanpuce@gmail.com |
        <a
          href="https://www.facebook.com/groups/1078122210620320"
          target="_blank"
          class="text-blue-600 hover:underline"
          >Réseau lecteur de puce France</a
        >
      </p>

      <h3 class="text-lg font-medium mb-2">2.2 Durée de Conservation</h3>
      <p>Les données sont conservées jusqu'à :</p>
      <ul class="list-disc pl-6">
        <li>Demande de suppression par le participant</li>
        <li>Retrait du consentement</li>
        <li>Fin d'activité du service</li>
      </ul>
    </section>

    <section class="mb-8">
      <h2 class="text-xl font-semibold mb-4">3. Droits des Utilisateurs</h2>
      <p>Conformément au RGPD, vous disposez des droits suivants :</p>
      <ul class="list-disc pl-6">
        <li>Accès à vos données</li>
        <li>Rectification des informations</li>
        <li>Suppression de vos données</li>
        <li>Retrait du consentement</li>
        <li>Opposition au traitement</li>
      </ul>
      <p class="mt-4">
        Pour exercer ces droits, contactez : reseau.scanpuce@gmail.com |
        <a
          href="https://www.facebook.com/groups/1078122210620320"
          target="_blank"
          class="text-blue-600 hover:underline"
          >Réseau lecteur de puce France</a
        >
      </p>
    </section>

    <section class="mb-8">
      <h2 class="text-xl font-semibold mb-4">5. Cookies et Traceurs</h2>
      <p>
        Le site utilise uniquement Vercel Analytics pour des statistiques de
        visite anonymisées.
      </p>
    </section>

    <section class="mb-8">
      <h2 class="text-xl font-semibold mb-4">6. Modifications</h2>
      <p>
        Nous nous réservons le droit de modifier cette politique de
        confidentialité. Les utilisateurs seront informés des changements
        importants.
      </p>
      <p class="mt-4">Date de dernière mise à jour : {{ updateDate }}</p>
    </section>
  </div>
</template>

<script setup>
import { ref } from "vue";

const updateDate = ref("24/01/2025");
</script>
