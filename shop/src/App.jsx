import { useEffect, useMemo, useState } from "react";
import "./App.css";

const API = "http://localhost:3001";
const SIZES = ["36","37","38","39","40","41"];
const n = v => Number(v || 0);

const money = value =>
  n(value).toLocaleString("tr-TR", {
    style:"currency",
    currency:"TRY",
    maximumFractionDigits:0
  });

function imageUrl(path) {
  if (!path) return "";

  return path.startsWith("/uploads/")
    ? API+path
    : path;
}

function totalStock(product) {
  return (product.colors || []).reduce(
    (sum,color) =>
      sum +
      Object.values(color.sizes || {})
        .reduce(
          (s,v) => s+n(v),
          0
        ),
    0
  );
}

function salePrice(product) {
  if (product.salePrice!=null) {
    return n(product.salePrice);
  }

  const discount =
    Math.max(
      0,
      Math.min(100,n(product.discount))
    );

  return Math.round(
    (
      n(product.price) *
      (1-discount/100)
    ) * 100
  ) / 100;
}

function firstImage(product) {
  return (
    product.colors?.[0]?.images?.[0] ||
    product.colors?.[0]?.image ||
    product.image ||
    ""
  );
}

export default function App() {
  const [authToken,setAuthToken]=useState(()=>localStorage.getItem("sheliva-token")||"");
  const [authUser,setAuthUser]=useState(null);
  const [authOpen,setAuthOpen]=useState(false);
  const [authMode,setAuthMode]=useState("login");
  const [otpSent,setOtpSent]=useState(false);
  const [products,setProducts] =
    useState([]);

  const [loading,setLoading] =
    useState(true);

  const [connected,setConnected] =
    useState(false);

  const [page,setPage] =
    useState("home");

  const [selected,setSelected] =
    useState(null);

  const [selectedColor,setSelectedColor] =
    useState(null);

  const [selectedSize,setSelectedSize] =
    useState(null);

  const [activePhoto,setActivePhoto] =
    useState("");

  const [filter,setFilter] =
    useState("Tümü");

  const [search,setSearch] =
    useState("");

  const [cart,setCart] =
    useState(
      () =>
        JSON.parse(
          localStorage.getItem(
            "sheliva-cart-v3"
          ) || "[]"
        )
    );

  const [cartOpen,setCartOpen] =
    useState(false);

  const [checkout,setCheckout] =
    useState(false);

  const [orderSuccess,setOrderSuccess] =
    useState(null);

  async function refreshProducts() {
    try {
      const res =
        await fetch(
          `${API}/api/products`
        );

      if (!res.ok) {
        throw new Error();
      }

      setProducts(
        (await res.json())
          .filter(
            p => p.active!==false
          )
      );

      setConnected(true);
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(()=>{
    refreshProducts();

    const timer =
      setInterval(
        refreshProducts,
        2000
      );

    return () =>
      clearInterval(timer);
  },[]);

  useEffect(()=>{
    localStorage.setItem(
      "sheliva-cart-v3",
      JSON.stringify(cart)
    );
  },[cart]);

  const filtered =
    useMemo(()=>{
      let list =
        [...products];

      if (filter==="Yazlık") {
        list =
          list.filter(
            p => p.category==="Yazlık"
          );
      }

      if (filter==="Kışlık") {
        list =
          list.filter(
            p => p.category==="Kışlık"
          );
      }

      if (filter==="Yeni Sezon") {
        list =
          list.filter(
            p => p.newest!==false
          );
      }

      if (filter==="İndirimde") {
        list =
          list.filter(
            p => n(p.discount)>0
          );
      }

      if (filter==="Son Gelenler") {
        list =
          [...list].sort(
            (a,b) =>
              new Date(b.createdAt) -
              new Date(a.createdAt)
          );
      }

      if (search.trim()) {
        list =
          list.filter(
            p =>
              p.name
                .toLocaleLowerCase("tr")
                .includes(
                  search
                    .toLocaleLowerCase("tr")
                )
          );
      }

      return list;
    },[
      products,
      filter,
      search
    ]);

  const cartCount =
    cart.reduce(
      (s,item) =>
        s+n(item.qty),
      0
    );

  const cartTotal =
    cart.reduce(
      (s,item) =>
        s+n(item.price)*n(item.qty),
      0
    );

  const discounted =
    products.filter(
      p =>
        n(p.discount)>0 &&
        totalStock(p)>0
    );

  const bestSellers =
    [...products]
      .filter(
        p => totalStock(p)>0
      )
      .sort(
        (a,b) =>
          n(b.totalSold) -
          n(a.totalSold)
      );

  const promoProduct =
    discounted[0] ||
    bestSellers[0] ||
    products[0];

  const bestseller =
    bestSellers[0] ||
    discounted[0] ||
    products[0];

  function openProduct(product) {
    const color =
      product.colors?.[0] ||
      null;

    setSelected(product);
    setSelectedColor(color);
    setSelectedSize(null);

    setActivePhoto(
      color?.images?.[0] ||
      color?.image ||
      product.image ||
      ""
    );

    setPage("product");
    window.scrollTo(0,0);
  }

  function goHome(category="Tümü") {
    setPage("home");
    setFilter(category);

    setTimeout(()=>{
      if (category==="Tümü") {
        window.scrollTo({
          top:0,
          behavior:"smooth"
        });
      } else {
        document
          .querySelector("#products")
          ?.scrollIntoView({
            behavior:"smooth"
          });
      }
    },50);
  }

  function addToCart() {
    if (!selectedColor) {
      return alert("Renk seç.");
    }

    if (!selectedSize) {
      return alert("Numara seç.");
    }

    const stock =
      n(
        selectedColor
          .sizes?.[String(selectedSize)]
      );

    if (stock<=0) {
      return alert(
        "Bu numara tükendi."
      );
    }

    const key =
      `${selected.id}-${selectedColor.id}-${selectedSize}`;

    setCart(prev => {
      const found =
        prev.find(
          item =>
            item.key===key
        );

      if (found) {
        if (found.qty>=stock) {
          return prev;
        }

        return prev.map(
          item =>
            item.key===key
              ? {
                  ...item,
                  qty:item.qty+1,
                  maxStock:stock
                }
              : item
        );
      }

      return [
        ...prev,
        {
          key,
          productId:selected.id,
          name:selected.name,

          colorId:selectedColor.id,
          colorName:selectedColor.name,

          size:selectedSize,

          image:
            selectedColor.images?.[0] ||
            selectedColor.image ||
            selected.image,

          listPrice:n(selected.price),
          discount:n(selected.discount),
          price:salePrice(selected),

          qty:1,
          maxStock:stock
        }
      ];
    });

    setCartOpen(true);
  }

  function changeQty(key,delta) {
    setCart(
      prev =>
        prev
          .map(item => {
            if (item.key!==key) {
              return item;
            }

            const product =
              products.find(
                p =>
                  Number(p.id) ===
                  Number(item.productId)
              );

            const color =
              product?.colors?.find(
                c => c.id===item.colorId
              );

            const stock =
              n(
                color
                  ?.sizes?.[String(item.size)]
              );

            const next =
              item.qty+delta;

            if (
              delta>0 &&
              next>stock
            ) {
              return item;
            }

            return {
              ...item,
              qty:next,
              maxStock:stock
            };
          })
          .filter(
            item => item.qty>0
          )
    );
  }

  async function placeOrder(event) {
    event.preventDefault();

    const form =
      new FormData(
        event.currentTarget
      );

    const body = {
      source:"SHELIVA Web",

      cargoFee:
        n(form.get("cargoFee")),

      paymentMethod:
        form.get("paymentMethod"),

      paymentStatus:"Bekliyor",

      customer:{
        name:form.get("name"),
        phone:form.get("phone"),
        email:form.get("email"),

        city:form.get("city"),
        district:form.get("district"),
        neighborhood:form.get("neighborhood"),
        postalCode:form.get("postalCode"),

        address:form.get("address"),
        note:form.get("note")
      },

      items:cart
    };

    const res =
      await fetch(
        `${API}/api/orders`,
        {
          method:"POST",

          headers:{
            "Content-Type":"application/json"
          },

          body:
            JSON.stringify(body)
        }
      );

    const data =
      await res.json();

    if (!res.ok) {
      return alert(
        data.error ||
        "Sipariş oluşturulamadı."
      );
    }

    setOrderSuccess(data);
    setCart([]);

    await refreshProducts();
  }

  if (loading) {
    return (
      <div className="loading">
        SHELİVA
      </div>
    );
  }

  return (
    <div className="site">

      <header className="header">

        <button
          className="menu"
          onClick={()=>goHome()}
        >
          ☰
          {" "}
          <small>MENU</small>
        </button>

        <button
          className="brand"
          onClick={()=>goHome()}
        >
          SHELİVA
        </button>

        <div className="headerIcons">

          <div className="headerSearch">
            ⌕
            <input
              placeholder="Ara"
              value={search}
              onChange={e=>
                setSearch(
                  e.target.value
                )
              }
            />
          </div>

          <button
            className="headerCart"
            onClick={()=>
              setCartOpen(true)
            }
          >
            🛍

            <span>
              {cartCount}
            </span>
          </button>

        </div>

      </header>

      {!connected && (
        <div className="serverWarning">
          Sunucu bağlantısı yok.
        </div>
      )}

      {page==="home" && (
        <main className="homeMain">

          <section className="heroBanner heroTop">

            <div className="heroPhoto">
              <img
                src={
                  promoProduct
                    ? imageUrl(
                        firstImage(promoProduct)
                      )
                    : "/products/yazlik-2.png"
                }
              />
            </div>

            <div className="heroBlack">

              <h1>
                {promoProduct
                  ? n(promoProduct.discount)>0
                    ? "İndirimde Öne Çıkan"
                    : "Özelleştirilmiş Koleksiyon"
                  : "Özelleştirilmiş Koleksiyon"}
              </h1>

              <b>BY SHELİVA</b>
              <i></i>

              <span>
                {promoProduct
                  ? promoProduct.name
                  : "YAZ 2026"}
              </span>

              {promoProduct && (
                <button
                  className="heroAction"
                  onClick={()=>
                    openProduct(promoProduct)
                  }
                >
                  İNCELE
                </button>
              )}

            </div>

          </section>

          <section className="heroBanner heroBottom">

            <div className="heroBlack">

              <h1>En Çok Satan</h1>

              <b>BY SHELİVA</b>
              <i></i>

              <span>
                {bestseller
                  ? bestseller.name
                  : "SUMMER COLLECTION"}
              </span>

              {bestseller && (
                <button
                  className="heroAction"
                  onClick={()=>
                    openProduct(bestseller)
                  }
                >
                  İNCELE
                </button>
              )}

            </div>

            <div className="heroPhoto">
              <img
                src={
                  bestseller
                    ? imageUrl(
                        firstImage(bestseller)
                      )
                    : "/products/yazlik-1.png"
                }
              />
            </div>

          </section>

          <section className="categoryGrid">

            {[
              [
                "YAZLIK",
                "Yazlık",
                "/products/yazlik-2.png"
              ],
              [
                "KIŞLIK",
                "Kışlık",
                "/products/kislik-2.png"
              ],
              [
                "YENİ SEZON",
                "Yeni Sezon",
                "/products/yazlik-4.png"
              ],
              [
                "İNDİRİMDE",
                "İndirimde",
                discounted[0]
                  ? imageUrl(
                      firstImage(discounted[0])
                    )
                  : "/products/kislik-4.png"
              ],
              [
                "TÜM ÜRÜNLER",
                "Tümü",
                "/products/yazlik-1.png"
              ],
              [
                "SON GELENLER",
                "Son Gelenler",
                "/products/kislik-3.png"
              ]
            ].map(
              ([title,key,img]) => (
                <button
                  key={title}
                  onClick={()=>
                    goHome(key)
                  }
                >
                  <img src={img}/>
                  <strong>{title}</strong>
                  <span>by SHELİVA</span>
                </button>
              )
            )}

          </section>

          <section
            id="products"
            className="products"
          >

            <div className="productsTitle">
              <span>SHELİVA</span>

              <h2>
                {filter==="Tümü"
                  ? "Tüm Ürünler"
                  : filter}
              </h2>
            </div>

            {!filtered.length ? (
              <div className="noProducts">
                Henüz ürün eklenmedi.
                <small>
                  Ürünler yönetim panelinden eklenir.
                </small>
              </div>
            ) : (
              <div className="productsGrid">

                {filtered.map(
                  product => (
                    <article
                      className="productCard"
                      key={product.id}
                      onClick={()=>
                        openProduct(product)
                      }
                    >

                      <div className="productImg">

                        {firstImage(product) ? (
                          <img
                            src={
                              imageUrl(
                                firstImage(product)
                              )
                            }
                          />
                        ) : (
                          <div className="noImage">
                            SHELİVA
                          </div>
                        )}

                        {n(product.discount)>0 && (
                          <span className="saleTag">
                            %{product.discount}
                          </span>
                        )}

                      </div>

                      <div className="productCardText">

                        <small>
                          {product.category}
                        </small>

                        <h3>
                          {product.name}
                        </h3>

                        <div className="priceArea">

                          {n(product.discount)>0 && (
                            <del>
                              {money(product.price)}
                            </del>
                          )}

                          <strong>
                            {money(
                              salePrice(product)
                            )}
                          </strong>

                        </div>

                        <span
                          className={
                            totalStock(product)>0
                              ? "stockAvailable"
                              : "stockOut"
                          }
                        >
                          {totalStock(product)>0
                            ? `${totalStock(product)} adet stok`
                            : "Tükendi"}
                        </span>

                        <button
                          disabled={
                            totalStock(product)<=0
                          }
                        >
                          {totalStock(product)>0
                            ? "ÜRÜNÜ İNCELE"
                            : "TÜKENDİ"}
                        </button>

                      </div>

                    </article>
                  )
                )}

              </div>
            )}

          </section>

        </main>
      )}

      {page==="product" && selected && (
        <main className="productPage">

          <div className="breadcrumb">

            <button
              onClick={()=>goHome()}
            >
              Ana Sayfa
            </button>

            <span>/</span>

            <b>
              {selected.name}
            </b>

          </div>

          <section className="detailTop v3Product">

            <div className="galleryV3">

              <div className="thumbsV3">

                {(
                  selectedColor?.images ||
                  (
                    selectedColor?.image
                      ? [selectedColor.image]
                      : []
                  )
                ).map(
                  (img,index) => (
                    <button
                      key={index}
                      className={
                        activePhoto===img
                          ? "active"
                          : ""
                      }
                      onClick={()=>
                        setActivePhoto(img)
                      }
                    >
                      <img
                        src={
                          imageUrl(img)
                        }
                      />
                    </button>
                  )
                )}

              </div>

              <div className="mainPhotoV3">

                {activePhoto ? (
                  <img
                    src={
                      imageUrl(activePhoto)
                    }
                  />
                ) : (
                  <div className="noImage">
                    SHELİVA
                  </div>
                )}

              </div>

            </div>

            <div className="detailInfo">

              <small>
                {selected.code}
              </small>

              <h1>
                {selected.name}
              </h1>

              <div className="detailPriceV3">

                <div>

                  {n(selected.discount)>0 && (
                    <del>
                      {money(selected.price)}
                    </del>
                  )}

                  <strong>
                    {money(
                      salePrice(selected)
                    )}
                  </strong>

                </div>

                {n(selected.discount)>0 && (
                  <span>
                    %{selected.discount} İndirim
                  </span>
                )}

              </div>

              <div className="optionBlock">

                <label>RENK</label>

                <div className="colorSelector">

                  {(selected.colors||[])
                    .map(color => (
                      <button
                        key={color.id}
                        className={
                          selectedColor?.id===color.id
                            ? "active"
                            : ""
                        }
                        onClick={()=>{
                          setSelectedColor(color);
                          setSelectedSize(null);
                          setActivePhoto(
                            color.images?.[0] ||
                            color.image ||
                            ""
                          );
                        }}
                      >

                        {(color.images?.[0] || color.image) && (
                          <img
                            src={
                              imageUrl(
                                color.images?.[0] ||
                                color.image
                              )
                            }
                          />
                        )}

                        <span>
                          {color.name}
                        </span>

                      </button>
                    ))}

                </div>

              </div>

              <div className="optionBlock">

                <label>NUMARA</label>

                <div className="sizes">

                  {SIZES.map(size => {
                    const stock =
                      n(
                        selectedColor
                          ?.sizes?.[size]
                      );

                    return (
                      <button
                        key={size}
                        disabled={stock<=0}
                        className={
                          String(selectedSize)===size
                            ? "active"
                            : ""
                        }
                        onClick={()=>
                          setSelectedSize(size)
                        }
                      >
                        {size}

                        <small>
                          {stock>0
                            ? `${stock} adet`
                            : "Yok"}
                        </small>
                      </button>
                    );
                  })}

                </div>

              </div>

              <button
                className="addButton"
                disabled={
                  !selectedColor ||
                  !selectedSize ||
                  n(
                    selectedColor
                      ?.sizes?.[String(selectedSize)]
                  )<=0
                }
                onClick={addToCart}
              >
                {!selectedSize
                  ? "NUMARA SEÇ"
                  : n(
                      selectedColor
                        ?.sizes?.[String(selectedSize)]
                    )<=0
                    ? "TÜKENDİ"
                    : "SEPETE EKLE"}
              </button>

              <div className="productMeta">

                <span>
                  Stok:
                  {" "}
                  <b>
                    {totalStock(selected)}
                  </b>
                </span>

                <span>
                  İndirimli fiyat otomatik hesaplanır.
                </span>

              </div>

            </div>

          </section>

        </main>
      )}

      <div
        className={
          cartOpen
            ? "drawerShade show"
            : "drawerShade"
        }
        onClick={()=>
          setCartOpen(false)
        }
      ></div>

      <aside
        className={
          cartOpen
            ? "sideDrawer open"
            : "sideDrawer"
        }
      >

        <div className="drawerHead">

          <h2>
            Sepetim ({cartCount})
          </h2>

          <button
            onClick={()=>
              setCartOpen(false)
            }
          >
            ×
          </button>

        </div>

        {!checkout ? (
          <>

            <div className="drawerContent">

              {!cart.length && (
                <div className="empty">
                  Sepetin boş.
                </div>
              )}

              {cart.map(item => (
                <div
                  className="drawerItem"
                  key={item.key}
                >

                  <img
                    src={
                      imageUrl(item.image)
                    }
                  />

                  <div>

                    <h4>{item.name}</h4>

                    <p>
                      {item.colorName}
                      {" • "}
                      {item.size}
                    </p>

                    <strong>
                      {money(
                        item.price *
                        item.qty
                      )}
                    </strong>

                    <div className="drawerQty">

                      <button
                        onClick={()=>
                          changeQty(
                            item.key,
                            -1
                          )
                        }
                      >
                        −
                      </button>

                      <span>
                        {item.qty}
                      </span>

                      <button
                        disabled={
                          item.qty>=item.maxStock
                        }
                        onClick={()=>
                          changeQty(
                            item.key,
                            1
                          )
                        }
                      >
                        +
                      </button>

                    </div>

                    <small className="stockHint">
                      Maks. {item.maxStock} adet
                    </small>

                  </div>

                  <button
                    className="remove"
                    onClick={()=>
                      setCart(
                        cart.filter(
                          x => x.key!==item.key
                        )
                      )
                    }
                  >
                    ×
                  </button>

                </div>
              ))}

            </div>

            {!!cart.length && (
              <div className="drawerBottom">

                <div className="drawerTotal">
                  <span>Toplam</span>
                  <strong>
                    {money(cartTotal)}
                  </strong>
                </div>

                <button
                  onClick={()=>
                    setCheckout(true)
                  }
                >
                  SİPARİŞİ TAMAMLA
                </button>

              </div>
            )}

          </>
        ) : (
          <form
            className="checkoutForm"
            onSubmit={placeOrder}
          >

            {!orderSuccess ? (
              <>

                <button
                  type="button"
                  onClick={()=>
                    setCheckout(false)
                  }
                >
                  ← Sepete dön
                </button>

                <h3>
                  Teslimat Bilgileri
                </h3>

                <input
                  name="name"
                  required
                  placeholder="Ad Soyad"
                />

                <input
                  name="phone"
                  required
                  placeholder="Telefon"
                />

                <input
                  name="email"
                  type="email"
                  required
                  placeholder="E-posta"
                />

                <div className="checkoutTwo">

                  <input
                    name="city"
                    required
                    placeholder="İl"
                  />

                  <input
                    name="district"
                    required
                    placeholder="İlçe"
                  />

                </div>

                <div className="checkoutTwo">

                  <input
                    name="neighborhood"
                    placeholder="Mahalle"
                  />

                  <input
                    name="postalCode"
                    placeholder="Posta Kodu"
                  />

                </div>

                <textarea
                  name="address"
                  required
                  placeholder="Açık adres"
                />

                <textarea
                  name="note"
                  placeholder="Sipariş notu"
                />

                <select
                  name="paymentMethod"
                  defaultValue="Kapıda / Taslak"
                >
                  <option>
                    Kapıda / Taslak
                  </option>

                  <option>
                    Havale / EFT
                  </option>

                  <option>
                    Kart (entegrasyon sonrası)
                  </option>
                </select>

                <input
                  type="hidden"
                  name="cargoFee"
                  value="0"
                />

                <div className="drawerTotal">
                  <span>Toplam</span>
                  <strong>
                    {money(cartTotal)}
                  </strong>
                </div>

                <button
                  className="orderButton"
                  type="submit"
                >
                  SİPARİŞ VER
                </button>

              </>
            ) : (
              <div className="success">

                <b>✓</b>

                <h3>
                  Sipariş Alındı
                </h3>

                <p>
                  Sipariş No:
                </p>

                <strong>
                  {orderSuccess.orderNo}
                </strong>

                <button
                  type="button"
                  onClick={()=>{
                    setOrderSuccess(null);
                    setCheckout(false);
                    setCartOpen(false);
                    goHome();
                  }}
                >
                  TAMAM
                </button>

              </div>
            )}

          </form>
        )}

      </aside>

    </div>
  );
}

