import { startFoilStore } from "../tests/fixtures/foil-store-server";
void startFoilStore(Number(process.env.FOIL_REVIEW_PORT) || 4188).then(({ origin }) => {
  console.log(
    `Docked finished foil-pack review: ${origin}/fantasy/cards?view=packs&sport=afl`,
  );
  console.log(
    "Read-only synthetic store. No Production connections or purchases.",
  );
});
