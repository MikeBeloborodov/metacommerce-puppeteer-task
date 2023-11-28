import puppeteer from "puppeteer-extra";
import { executablePath } from "puppeteer";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs";
import { json2csv } from "json-2-csv";

const titleSelector = "a.catalog-product__name";
const priceSelector = ".product-buy__price";
const moreButtonSelector = ".pagination-widget__show-more-btn";

puppeteer.use(StealthPlugin());

const sleep = async (ms: number) => {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, ms);
  });
};

const main = async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1024 });
  await page.setRequestInterception(true);

  // фильтр запросов
  // если отключить стили и fetch, то цены не грузит
  page.on("request", async (req) => {
    if (
      req.resourceType() === "image" ||
      req.resourceType() === "font" ||
      req.resourceType() === "media"
    ) {
      req.abort();
    } else {
      req.continue();
    }
  });

  console.log("Подключаюсь к страничке...");
  await page.goto(
    "https://www.dns-shop.ru/catalog/17a8d26216404e77/vstraivaemye-xolodilniki/",
  );

  // прожимаю "показать ещё" для загрузки всех товаров
  console.log("Загружаю все страницы с товарами...");
  let moreFlag = true;
  await page.waitForSelector(moreButtonSelector);
  while (moreFlag) {
    try {
      await page.click(moreButtonSelector);
      await page.waitForSelector(moreButtonSelector, { timeout: 5000 });
      // сплю между подгрузкой новых данных
      await sleep(1000);
    } catch (error) {
      moreFlag = false;
    }
  }
  // сплю для подгрузки цен
  await sleep(1000);

  console.log("Забираю наименования...");
  await page.waitForSelector(priceSelector);
  const titles = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll("a.catalog-product__name"),
      (element) => element.textContent,
    ),
  );

  // регуляркой фильтрую старые цены
  console.log("Забираю цены...");
  const prices = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".product-buy__price"), (element) => {
      let price;
      element.textContent
        ? (price = element.textContent.match(/[\d\s]+₽/))
        : null;
      if (price) return price[0];
    }),
  );

  let data: any = [];
  titles.forEach((title, index) => {
    data.push({
      title: title,
      price: prices[index],
    });
  });
  console.log("Сохраняю csv...");
  const csvString = json2csv(data);
  fs.writeFileSync("result.csv", csvString);

  await browser.close();
  console.log("Готово!");
  console.log("Файл result.csv находится в папке с проектом.");
};

main();
