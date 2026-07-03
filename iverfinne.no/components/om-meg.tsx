export default function OmMeg() {
  return (
    <div className="mx-auto mt-8 max-w-md space-y-6 pb-16">
      <img
        src="/images/om-meg.jpg"
        alt="Iver Finne"
        className="w-full rounded-lg"
      />
      <div className="space-y-4 font-serif text-gray-700 dark:text-gray-300 leading-relaxed">
        <p>
          Hei! Eg er Iver. Eg likar å lage ting: nokre gonger med kode, andre
          gonger med papir, blyant eller ein 3D-printar.
        </p>
        <p>
          Denne sida er arkivet mitt: små prosjekt, skisser og tekstar, samla på
          ein stad medan dei enno er varme.
        </p>
        <p>
          Finn meg gjerne på{' '}
          <a
            href="https://github.com/lukketsvane"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-gray-900 dark:hover:text-gray-100"
          >
            GitHub
          </a>
          .
        </p>
      </div>
    </div>
  )
}
