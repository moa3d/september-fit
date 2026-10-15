import { SeptemberFit } from "@september-fit/sdk";

SeptemberFit.init({
  sessionEndpoint: "/api/september-fit/session",
  fitOrigin: "https://fit.septemberfit.com",
  mode: "modal",
  onComplete(event) {
    console.log("Fit completed", event);

    // Optional:
    // refresh a product recommendation badge or cart UI.
  },
});

document
  .querySelector("[data-september-fit-button]")
  ?.addEventListener("click", async () => {
    await SeptemberFit.open({
      productId: "SEP-0491",
      externalCustomerId: "customer_735",
    });
  });
