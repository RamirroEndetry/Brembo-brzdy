// Step-by-step procedures. Every step names the tool it needs, the parts that
// have to be clicked and the animation (`act`) the engine plays for each click.

export const TOOLS = [
  { id: 'hand', name: 'Ruka', desc: 'Vyjmout nebo nasadit díl' },
  { id: 'ratchet', name: 'Ráčna', desc: 'Ráčna se sadou ořechů' },
  { id: 'torque', name: 'Momentový klíč', desc: 'Dotažení předepsaným momentem' },
  { id: 'screwdriver', name: 'Šroubovák', desc: 'Šroubovák a bity Torx' },
  { id: 'hammer', name: 'Kladivo', desc: 'Kladivo a průbojník' },
  { id: 'hook', name: 'Hák', desc: 'Hák na zavěšení třmenu' },
  { id: 'pistonTool', name: 'Stlačovák', desc: 'Stlačovák brzdových pístků' },
  { id: 'brush', name: 'Kartáč', desc: 'Drátěný kartáč' },
  { id: 'cleaner', name: 'Čistič brzd', desc: 'Odmašťovač ve spreji' },
  { id: 'paste', name: 'Pasta', desc: 'Vysokoteplotní pasta bez kovů (Brembo B-Quiet)' },
  { id: 'silicone', name: 'Silikon', desc: 'Silikonové mazivo na vodicí čepy' },
  { id: 'oil', name: 'Olej', desc: 'Univerzální mazací olej' },
];

export const VARIANTS = {
  standard: {
    name: 'Standardní sestava',
    short: 'Standard',
    desc: 'Audi A3 (8V). Plovoucí jednopístkový třmen s držákem a vodicími čepy, vnitřně chlazený kotouč 312 mm.',
    chips: ['1 pístek', 'kotouč 312 mm', 'plovoucí třmen'],
  },
  sport: {
    name: 'Sportovní sestava',
    short: 'Sport',
    desc: 'Rally Audi Sport quattro S1. Pevný čtyřpístkový monoblok Brembo, dvoudílný plovoucí děrovaný kotouč 355 mm.',
    chips: ['4 pístky', 'kotouč 355 mm', 'pevný monoblok'],
  },
};

export const MODES = {
  demontaz: { name: 'Demontáž', desc: 'Rozeberte brzdu krok za krokem – od třmenu až po kotouč.' },
  montaz: { name: 'Montáž', desc: 'Složte brzdu správně: čištění, mazání a utahovací momenty.' },
};

// camera presets: az/el in radians around the hub, steer = steering angle
const V = {
  front: { az: 0.3, el: 0.14, dist: 1.02, steer: 0 },
  hub: { az: 0.18, el: 0.12, dist: 0.8, steer: 0 },
  back: { az: 1.16, el: 0.06, dist: 0.8, steer: -0.66, look: [0.06, 0.02, 0.04] },
  top: { az: 1.05, el: 0.36, dist: 0.9, steer: -0.38, look: [0.07, 0.03, 0] },
  hang: { az: 0.35, el: 0.16, dist: 0.8, steer: 0, look: [0.07, 0.16, 0] },
  cart: { az: 0.4, el: 0.66, dist: 1.4, steer: 0, look: [1.0, -0.14, 0.5] },
  both: { az: 0.22, el: 0.44, dist: 1.85, steer: 0, look: [0.52, -0.1, 0.28] },
};
// Cart shot for picking a part off the cart before the camera moves to
// `view` for the work itself. Keeps the steering of the work view.
const fromCart = (view) => ({ ...V.cart, steer: view.steer });

const WHY_TORQUE =
  'Utahovací momenty se liší podle vozu. Hodnoty v trenažéru jsou orientační – při skutečné práci vždy platí dílenská příručka výrobce.';

const standardDemontaz = [
  {
    id: 'guideBolts',
    title: 'Povolte vodicí šrouby třmenu',
    text: 'Řízení je natočené, takže je vidět zadní strana třmenu. Ráčnou s ořechem 13 mm povolte oba vodicí šrouby. Vodicí čep se přitom přidržuje plochým klíčem 17 mm, aby se neprotáčel.',
    why: 'Plovoucí třmen má pístek jen na vnitřní straně. Celý se posouvá po dvou vodicích čepech, a tím přitáhne ke kotouči i vnější destičku.',
    tool: 'ratchet',
    targets: ['guideBolt1', 'guideBolt2'],
    act: 'unbolt',
    view: V.back,
  },
  {
    id: 'hang',
    title: 'Sejměte třmen a zavěste ho',
    text: 'Vezměte hák a klikněte na třmen. Třmen se vyklopí z držáku a zavěsí za pružinu podvozku.',
    warn: 'Třmen nikdy nenechávejte viset na brzdové hadici. Hadice se uvnitř naruší a brzda pak přibrzďuje, nebo úplně selže.',
    tool: 'hook',
    targets: ['caliper'],
    act: 'hang',
    view: V.front,
  },
  {
    id: 'pads',
    title: 'Vyjměte brzdové destičky',
    text: 'Rukou vytáhněte z držáku vnější i vnitřní destičku.',
    why: 'Podívejte se, kolik obložení zbývá – minimum jsou 2 až 3 mm. Když je jedna destička sjetá výrazně víc než druhá, bývají zatuhlé vodicí čepy nebo pístek.',
    tool: 'hand',
    targets: ['padOuter', 'padInner'],
    act: 'remove',
    view: V.top,
  },
  {
    id: 'clips',
    title: 'Vyjměte vodicí plechy',
    text: 'Plochým šroubovákem vyloupněte nerezové vodicí plechy z držáku.',
    why: 'Plechy drží destičky bez vůle a zároveň je nechávají volně klouzat. Unavené plechy způsobují klepání a pískání, proto se s novými destičkami mění.',
    tool: 'screwdriver',
    targets: ['clip1', 'clip2'],
    act: 'remove',
    view: V.top,
  },
  {
    id: 'bracketBolts',
    title: 'Povolte šrouby držáku třmenu',
    text: 'Držák drží na těhlici dva silné šrouby (ořech 18 mm). Bývají zajištěné lepidlem na závity – první povolení chce sílu a dlouhou páku.',
    why: 'Tyhle dva šrouby přenášejí celou brzdnou sílu z třmenu do těhlice. Proto se při montáži dotahují momentovým klíčem a řada výrobců předepisuje pokaždé nové.',
    tool: 'ratchet',
    targets: ['bracketBolt1', 'bracketBolt2'],
    act: 'unbolt',
    view: V.back,
  },
  {
    id: 'bracket',
    title: 'Sejměte držák třmenu',
    text: 'Držák vysuňte od kotouče směrem ven a odložte na vozík.',
    tip: 'Dosedací plochy pod vodicími plechy bývají plné rzi a prachu z destiček. Před montáží je čeká drátěný kartáč.',
    tool: 'hand',
    targets: ['bracket'],
    act: 'remove',
    view: V.top,
  },
  {
    id: 'discScrew',
    title: 'Vyšroubujte zajišťovací šroub kotouče',
    text: 'V čele kotouče je malý šroubek s hlavou Torx T30. Vyšroubujte ho šroubovákem.',
    why: 'Šroubek jen drží kotouč na místě, dokud není nasazené kolo. Brzdnou sílu přenáší sevření kotouče mezi kolem a nábojem.',
    tip: 'Bývá zarezlý. Hlavu nejdřív očistěte, bit nasaďte až na doraz a lehce na něj poklepejte – jinak se strhne.',
    tool: 'screwdriver',
    targets: ['discScrew'],
    act: 'unbolt',
    view: V.hub,
  },
  {
    id: 'disc',
    title: 'Sejměte kotouč',
    text: 'Stáhněte kotouč z náboje. Když drží rzí na středění, pomůže pár úderů kladivem zezadu na třecí plochu – starý kotouč už šetřit nemusíte.',
    why: 'Pod kotoučem se objeví zrezlá dosedací plocha náboje. Právě tu je potřeba před montáží nového kotouče vyčistit až na kov.',
    tool: ['hand', 'hammer'],
    targets: ['disc'],
    act: 'remove',
    view: V.front,
  },
];

const cleanHub = {
  id: 'cleanHub',
  title: 'Očistěte dosedací plochu náboje',
  text: 'Drátěným kartáčem odstraňte rez z čela náboje i ze středicího nákružku. Plocha musí být čistá až na kov.',
  why: 'Stačí desetina milimetru rzi pod kotoučem a kotouč hází. Za jízdy se to projeví vibracemi volantu a pulzováním pedálu, které se často mylně svádí na „zkroucené kotouče“.',
  tool: 'brush',
  targets: ['hub'],
  act: 'brush',
  at: { hub: { point: [0, 0, 0.004], axis: [0, 0, 1], radius: 0.046 } },
  view: V.hub,
};

const pasteHub = {
  id: 'pasteHub',
  title: 'Namažte středicí nákružek náboje',
  text: 'Na středicí nákružek naneste tenký film vysokoteplotní pasty bez obsahu kovů.',
  why: 'Tenký film zabrání tomu, aby kotouč a kolo příště přirezly k náboji. Stačí opravdu málo.',
  warn: 'Dosedací čelo náboje nechte čisté a suché. Mazivo nepatří ani na závity šroubů kol – zkreslilo by utahovací moment.',
  tool: 'paste',
  targets: ['hub'],
  act: 'grease',
  grease: { hub: ['hub'] },
  at: { hub: { point: [0, 0.029, 0.012], axis: [0, 0.5, 0.86], radius: 0.006 } },
  view: V.hub,
};

const degreaseDisc = (sport) => ({
  id: 'degrease',
  title: 'Odmastěte nový kotouč',
  text: 'Nový kotouč leží na vozíku. Čističem brzd z něj smyjte konzervační olej z obou třecích ploch.',
  why: sport
    ? 'Olej z výroby by se vpil do nových destiček a ty by pak trvale ztratily účinek. U kotoučů Brembo s ochranným UV lakem se třecí plochy neodmašťují – lak se setře při prvních brzděních.'
    : 'Olej chrání kotouč ve skladu před rzí. Kdyby zůstal, vpije se do nových destiček a ty trvale ztratí účinek. Kotouče s ochranným lakem (například Brembo UV) se odmašťovat nemusí.',
  tool: 'cleaner',
  targets: ['disc'],
  act: 'spray',
  at: { disc: { point: [0, 0, -0.01], axis: [0, -0.55, 0.83], radius: 0.06 } },
  view: V.cart,
});

const placeDisc = (sport) => ({
  id: 'placeDisc',
  title: 'Nasaďte kotouč na náboj',
  text: 'Kotouč nasaďte na středicí nákružek tak, aby otvor pro zajišťovací šroub lícoval se závitem v náboji.',
  why: sport
    ? 'Sportovní kotouče s tvarovanými chladicími kanálky a drážkami jsou směrové – levý a pravý kus se liší. Správná strana bývá vyražená na zvonu kotouče.'
    : 'Kotouč musí na náboj dosednout celou plochou. Kdyby zůstal pod ním kousek rzi nebo nečistota, bude házet.',
  tool: 'hand',
  targets: ['disc'],
  act: 'install',
  view: V.both,
});

const screwDisc = {
  id: 'screwDisc',
  title: 'Zajistěte kotouč šroubkem',
  text: 'Zajišťovací šroubek zašroubujte šroubovákem a dotáhněte jen lehce.',
  why: 'Šroubek kotouč jen přidržuje na místě. Přetažený se příště nepodaří povolit.',
  torque: '≈ 5 Nm',
  tool: 'screwdriver',
  targets: ['discScrew'],
  act: 'bolt',
  view: V.hub,
  pickView: fromCart(V.hub),
};

const standardMontaz = [
  cleanHub,
  pasteHub,
  degreaseDisc(false),
  placeDisc(false),
  screwDisc,
  {
    id: 'cleanBracket',
    title: 'Očistěte držák třmenu',
    text: 'Držák leží na vozíku. Drátěným kartáčem vyčistěte dosedací plochy pod vodicími plechy až na kov.',
    why: 'Rez pod plechy zvedá plechy proti destičkám a ty se v držáku zadírají. Destička pak neodléhá od kotouče, přehřívá se a rychle se sjede.',
    tool: 'brush',
    targets: ['bracket'],
    act: 'brush',
    at: { bracket: { point: [0, 0, 0.042], axis: [0, 0, 1], radius: 0.05 } },
    view: V.cart,
  },
  {
    id: 'placeBracket',
    title: 'Nasaďte držák třmenu',
    text: 'Držák nasuňte přes kotouč na těhlici.',
    tool: 'hand',
    targets: ['bracket'],
    act: 'install',
    view: V.both,
  },
  {
    id: 'torqueBracket',
    title: 'Dotáhněte šrouby držáku',
    text: 'Oba šrouby držáku zašroubujte a dotáhněte momentovým klíčem. Použijte nové šrouby, nebo na očištěný závit naneste lepidlo na závity.',
    why: WHY_TORQUE,
    torque: '≈ 120 Nm',
    tool: 'torque',
    targets: ['bracketBolt1', 'bracketBolt2'],
    act: 'bolt',
    view: V.back,
    pickView: fromCart(V.back),
  },
  {
    id: 'placeClips',
    title: 'Nasaďte nové vodicí plechy',
    text: 'Do vyčištěného držáku zacvakněte nové nerezové vodicí plechy z montážní sady.',
    tool: 'hand',
    targets: ['clip1', 'clip2'],
    act: 'install',
    view: V.both,
  },
  {
    id: 'pasteContacts',
    title: 'Namažte dosedací plochy destiček',
    text: 'Pastou natřete tenkou vrstvu na vodicí plechy v místech, kde po nich kloužou destičky. Potom na záda obou destiček tam, kde se o ně opírá pístek a prsty třmenu.',
    why: 'Pasta tlumí vibrace mezi kovovými díly – právě ty jsou slyšet jako pískání brzd. Zároveň destičky nezarezají v držáku.',
    warn: 'Mazivo se nesmí dostat na obložení destiček ani na třecí plochu kotouče. Méně je tady více.',
    tool: 'paste',
    targets: ['clip1', 'clip2', 'padOuter', 'padInner'],
    act: 'grease',
    grease: { clip1: ['clip1'], clip2: ['clip2'], padOuter: ['padOuter'], padInner: ['padInner'] },
    at: {
      clip1: { point: [0.0015, 0.005, 0.02], axis: [0.7, 0.4, 0.6], radius: 0.006 },
      clip2: { point: [-0.0015, 0.005, 0.02], axis: [-0.7, 0.4, 0.6], radius: 0.006 },
      padOuter: { point: [0, -0.006, 0.009], axis: [0, -0.4, 0.92], radius: 0.022 },
      padInner: { point: [0, 0, -0.009], axis: [0, 0.4, -0.92], radius: 0.014 },
    },
    view: V.both,
  },
  {
    id: 'placePads',
    title: 'Vložte nové destičky',
    text: 'Obě destičky zasuňte do držáku obložením ke kotouči.',
    why: 'Vnitřní destička bývá jiná než vnější – nese třeba akustický ukazatel opotřebení nebo pružinu, která ji drží v pístku. Zaměnit je nejde bez následků.',
    tool: 'hand',
    targets: ['padOuter', 'padInner'],
    act: 'install',
    view: V.both,
  },
  {
    id: 'pressPiston',
    title: 'Zatlačte pístek zpět do třmenu',
    text: 'Pístek je vysunutý podle starých, sjetých destiček. Stlačovákem ho rovnoměrně zatlačte zpět, aby se třmen vešel přes nové destičky.',
    why: 'Kapalina se při tom vrací do vyrovnávací nádobky. Sledujte hladinu, aby nepřetekla – brzdová kapalina leptá lak.',
    tip: 'Prohlédněte prachovou manžetu pístku. Když je popraskaná nebo pístek jde ztuha, třmen patří na repasi.',
    tool: 'pistonTool',
    targets: ['caliper'],
    act: 'press',
    view: V.hang,
  },
  {
    id: 'greasePins',
    title: 'Namažte vodicí čepy',
    text: 'Oba vodicí čepy vytáhněte, očistěte a namažte silikonovým mazivem. Zkontrolujte pryžové manžety.',
    why: 'Po čepech se celý třmen posouvá. Když zatuhnou, brzdí jen vnitřní destička, auto táhne ke straně a destičky se sjíždějí nerovnoměrně.',
    warn: 'Na čepy nepatří pasta s pevnými částicemi ani běžná vazelína. Minerální tuk nechá pryžové manžety nabobtnat a čep se zadře.',
    tool: 'silicone',
    targets: ['pin1', 'pin2'],
    act: 'greasePin',
    view: V.back,
  },
  {
    id: 'mountCaliper',
    title: 'Nasaďte třmen',
    text: 'Sundejte třmen z háku a nasaďte ho přes destičky do držáku. Dejte pozor, aby brzdová hadice nebyla překroucená.',
    tool: 'hand',
    targets: ['caliper'],
    act: 'mount',
    view: V.front,
  },
  {
    id: 'torqueGuide',
    title: 'Dotáhněte vodicí šrouby',
    text: 'Zašroubujte oba vodicí šrouby a dotáhněte je momentovým klíčem. Čep přitom přidržte plochým klíčem.',
    why: WHY_TORQUE,
    torque: '≈ 30 Nm',
    tool: 'torque',
    targets: ['guideBolt1', 'guideBolt2'],
    act: 'bolt',
    view: V.back,
    pickView: fromCart(V.back),
  },
];

const sportDemontaz = [
  {
    id: 'pins',
    title: 'Vyrazte zajišťovací čepy destiček',
    text: 'Destičky drží v třmenu dva čepy. Průbojníkem a kladivem je vyrazte z vnitřní strany směrem ven.',
    why: 'Pevný třmen se kvůli výměně destiček nemusí sundávat – destičky se vytahují horem. Na okruhu je to otázka pár minut.',
    tool: 'hammer',
    targets: ['retPin1', 'retPin2'],
    act: 'punchOut',
    view: V.top,
  },
  {
    id: 'spring',
    title: 'Vyjměte přítlačnou pružinu',
    text: 'Křížová pružina se po vytažení čepů uvolní. Vyjměte ji rukou.',
    why: 'Pružina tlačí destičky od čepů a brání jejich klepání. Při montáži musí přijít zpět ve stejné orientaci.',
    tool: 'hand',
    targets: ['padSpring'],
    act: 'remove',
    view: V.top,
  },
  {
    id: 'pads',
    title: 'Vytáhněte destičky',
    text: 'Obě destičky vytáhněte z třmenu směrem ven. Když drží, nejdřív je trochu odtlačte od kotouče.',
    why: 'Čtyři pístky tlačí na destičky z obou stran, třmen se nikam neposouvá. Proto je pevný třmen tužší a pedál má přesnější odezvu.',
    tool: 'hand',
    targets: ['padOuter', 'padInner'],
    act: 'remove',
    view: V.top,
  },
  {
    id: 'caliperBolts',
    title: 'Povolte radiální šrouby třmenu',
    text: 'Třmen drží na těhlici dva šrouby, které míří kolmo k ose kola. Povolte je ráčnou.',
    why: 'Radiální uchycení je tužší než klasické axiální a třmen se při brzdění méně kroutí. Přišlo z motorsportu.',
    tool: 'ratchet',
    targets: ['caliperBolt1', 'caliperBolt2'],
    act: 'unbolt',
    view: V.back,
  },
  {
    id: 'hang',
    title: 'Sejměte třmen a zavěste ho',
    text: 'Vezměte hák a klikněte na třmen. Třmen se vysune z kotouče a zavěsí za pružinu podvozku.',
    warn: 'Třmen nikdy nenechávejte viset na brzdové hadici. Monoblok je těžký a hadici snadno poškodí.',
    tool: 'hook',
    targets: ['caliper'],
    act: 'hang',
    view: V.front,
  },
  {
    id: 'discScrew',
    title: 'Vyšroubujte zajišťovací šroub kotouče',
    text: 'V čele zvonu kotouče je malý zajišťovací šroubek. Vyšroubujte ho šroubovákem.',
    why: 'Šroubek jen drží kotouč na místě, dokud není nasazené kolo.',
    tool: 'screwdriver',
    targets: ['discScrew'],
    act: 'unbolt',
    view: V.hub,
  },
  {
    id: 'disc',
    title: 'Sejměte kotouč',
    text: 'Stáhněte kotouč z náboje a odložte ho na vozík.',
    why: 'Dvoudílný kotouč má hliníkový zvon a litinový třecí prstenec spojený plovoucími pouzdry. Prstenec se může teplem volně roztahovat a kotouč se nekroutí.',
    tool: ['hand', 'hammer'],
    targets: ['disc'],
    act: 'remove',
    view: V.front,
  },
];

const sportMontaz = [
  cleanHub,
  pasteHub,
  degreaseDisc(true),
  placeDisc(true),
  screwDisc,
  {
    id: 'mountCaliper',
    title: 'Nasaďte třmen',
    text: 'Sundejte třmen z háku a nasuňte ho přes kotouč na těhlici. Hadice nesmí být překroucená.',
    tool: 'hand',
    targets: ['caliper'],
    act: 'mount',
    view: V.front,
  },
  {
    id: 'torqueCaliper',
    title: 'Dotáhněte radiální šrouby',
    text: 'Oba radiální šrouby zašroubujte a dotáhněte momentovým klíčem. Použijte nové šrouby.',
    why: WHY_TORQUE,
    torque: '≈ 100 Nm',
    tool: 'torque',
    targets: ['caliperBolt1', 'caliperBolt2'],
    act: 'bolt',
    view: V.back,
    pickView: fromCart(V.back),
  },
  {
    id: 'pressPistons',
    title: 'Zatlačte pístky do třmenu',
    text: 'Pístky jsou vysunuté podle starých destiček. Stlačovákem je rovnoměrně zatlačte zpět, všechny čtyři.',
    why: 'Kapalina se při tom vrací do vyrovnávací nádobky – sledujte hladinu. Pístky tlačte rovně, zkřížený pístek poškodí těsnění.',
    tool: 'pistonTool',
    targets: ['caliper'],
    act: 'press',
    view: V.top,
  },
  {
    id: 'pastePads',
    title: 'Namažte dosedací plochy destiček',
    text: 'Na záda destiček naneste tenkou vrstvu pasty v místech, kde se o ně opírají pístky, a na boční hrany, kterými se destička opírá o třmen.',
    why: 'Pasta tlumí vibrace mezi destičkou a pístky – ty jsou slyšet jako pískání. U sportovních směsí je to slyšet dvojnásob.',
    warn: 'Mazivo se nesmí dostat na obložení destiček ani na kotouč.',
    tool: 'paste',
    targets: ['padOuter', 'padInner'],
    act: 'grease',
    grease: { padOuter: ['padOuter'], padInner: ['padInner'] },
    at: {
      padOuter: { point: [0, -0.004, 0.009], axis: [0, -0.4, 0.92], radius: 0.028 },
      padInner: { point: [0, -0.004, -0.009], axis: [0, 0.4, -0.92], radius: 0.028 },
    },
    view: V.cart,
  },
  {
    id: 'placePads',
    title: 'Zasuňte nové destičky',
    text: 'Obě destičky zasuňte horem do třmenu, obložením ke kotouči.',
    tool: 'hand',
    targets: ['padOuter', 'padInner'],
    act: 'install',
    view: V.both,
  },
  {
    id: 'placeSpring',
    title: 'Vložte přítlačnou pružinu',
    text: 'Křížovou pružinu položte na destičky ve stejné orientaci, v jaké byla.',
    tool: 'hand',
    targets: ['padSpring'],
    act: 'install',
    view: V.both,
  },
  {
    id: 'placePins',
    title: 'Naklepněte zajišťovací čepy',
    text: 'Čepy prostrčte třmenem, destičkami i přes pružinu a kladivem je doklepněte na doraz.',
    why: 'Čep drží v třmenu jen svou rozpěrnou objímkou. Když není doražený, může za jízdy vypadnout i s destičkami.',
    tool: 'hammer',
    targets: ['retPin1', 'retPin2'],
    act: 'punchIn',
    view: V.top,
    pickView: fromCart(V.top),
  },
];

const PROCEDURES = {
  standard: { demontaz: standardDemontaz, montaz: standardMontaz },
  sport: { demontaz: sportDemontaz, montaz: sportMontaz },
};

export const getProcedure = (variant, mode) => PROCEDURES[variant][mode];

// Feedback for a wrong tool: specific (needed, chosen) pairs first, then per chosen tool.
const WRONG_PAIR = {
  'torque>ratchet': 'Ráčnou šroub dotáhnete jen odhadem. Tady rozhoduje předepsaný moment – vezměte momentový klíč.',
  'ratchet>torque': 'Momentový klíč je měřidlo na dotahování. Povolováním se rozhodí – vezměte ráčnu.',
  'silicone>paste': 'Pasta s pevnými částicemi čepy časem zadře a pryžovým manžetám nesvědčí. Na vodicí čepy patří silikonové mazivo.',
  'paste>silicone': 'Silikonové mazivo je na vodicí čepy a pryž. Na kovové dosedací plochy patří vysokoteplotní pasta.',
  'hook>hand': 'A kam s ním? Třmen nesmí zůstat viset na hadici – nejdřív si vezměte hák.',
  'brush>cleaner': 'Čistič rez nerozpustí. Tady pomůže jen mechanika – drátěný kartáč.',
  'cleaner>brush': 'Kartáč mastnotu jen rozmaže. Na konzervační olej je potřeba čistič brzd.',
};
const WRONG_TOOL = {
  oil: 'Olej ani univerzální mazací sprej na brzdy nikdy nepatří. Mastnota na kotouči nebo destičkách znamená brzdu, která nebrzdí.',
};

export function wrongToolMessage(needed, chosen) {
  const need = Array.isArray(needed) ? needed[0] : needed;
  return WRONG_PAIR[`${need}>${chosen}`] || WRONG_TOOL[chosen] || 'Tohle nářadí se na tenhle krok nehodí. Zkuste to znovu podle zadání.';
}

export const LESSONS = {
  demontaz: [
    'Třmen vždy zavěsit na hák. Nikdy ho nenechat viset na brzdové hadici.',
    'Staré díly napoví: nerovnoměrně sjeté destičky znamenají zatuhlé čepy nebo pístek.',
    'Zajišťovací šroub kotouče nejdřív očistit a poklepat, jinak se strhne.',
  ],
  montaz: [
    'Náboj očistit až na kov – jinak kotouč hází a volant vibruje.',
    'Mazivo jen tam, kam patří. Pasta na dosedací plochy, silikon na vodicí čepy, na třecí plochy nikdy nic.',
    'Nosné šrouby dotahovat momentovým klíčem podle dílenské příručky.',
    'Před jízdou několikrát sešlápnout pedál, zkontrolovat hladinu kapaliny a kola dotáhnout momentem.',
    'Nové destičky a kotouče zajet: prvních zhruba 300 km brzdit s citem.',
  ],
};

export const LUBE_PLAN = [
  { ok: true, where: 'Středicí nákružek náboje', what: 'Tenký film vysokoteplotní pasty bez kovů' },
  { ok: true, where: 'Vodicí plechy a hrany destiček', what: 'Tenká vrstva pasty (např. Brembo B-Quiet)' },
  { ok: true, where: 'Záda destiček pod pístkem a prsty třmenu', what: 'Tenká vrstva pasty' },
  { ok: true, where: 'Vodicí čepy plovoucího třmenu', what: 'Silikonové mazivo snášenlivé s pryží' },
  { ok: false, where: 'Třecí plochy kotouče a obložení destiček', what: 'Nikdy – mastná brzda nebrzdí' },
  { ok: false, where: 'Dosedací čelo náboje, závity šroubů kol', what: 'Čisté a suché, mazivo zkresluje moment' },
  { ok: false, where: 'Pryžové manžety a čepy', what: 'Žádný minerální tuk, olej ani měděná pasta' },
];
