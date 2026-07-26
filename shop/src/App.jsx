import { useEffect, useMemo, useState } from "react";
import "./App.css";

const API = "http://localhost:3001";

const money = n =>
  Number(n || 0).toLocaleString("tr-TR", {
    style:"currency",
    currency:"TRY",
    maximumFractionDigits:0
  });

function imageUrl(path) {
  if (!path) return "";

  if (path.startsWith("/uploads/")) {
    return API + path;
  }

  return path;
}

function totalStock(product) {
  return (product.colors || [])
    .reduce((sum,color) => {
      return sum +
        Object.values(color.sizes || {})
          .reduce(
            (s,v) =>
              s + Number(v || 0),
            0
          );
    },0);
}

export default function App() {

  const [products,setProducts] = useState([]);

  const [loading,setLoading] = useState(true);
  const [connected,setConnected] = useState(false);

  const [page,setPage] = useState("home");

  const [selected,setSelected] = useState(null);

  const [selectedColor,setSelectedColor] = useState(null);
  const [selectedSize,setSelectedSize] = useState(null);

  const [filter,setFilter] = useState("Tümü");
  const [search,setSearch] = useState("");

  const [cart,setCart] = useState(
    () =>
      JSON.parse(
        localStorage.getItem("sheliva-cart-v2") ||
        "[]"
      )
  );

  const [cartOpen,setCartOpen] = useState(false);

  const [checkout,setCheckout] = useState(false);
  const [orderSuccess,setOrderSuccess] = useState(null);


  async function refreshProducts() {
    try {
      const res = await fetch(
        `${API}/api/products`
      );

      if (!res.ok) {
        throw new Error();
      }

      setProducts(
        (await res.json())
          .filter(p => p.active !== false)
      );

      setConnected(true);

    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    refreshProducts();

    const timer =
      setInterval(
        refreshProducts,
        2500
      );

    return () =>
      clearInterval(timer);
  }, []);


  useEffect(() => {
    localStorage.setItem(
      "sheliva-cart-v2",
      JSON.stringify(cart)
    );
  }, [cart]);


  const filtered =
    useMemo(() => {

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
            p => p.newest !== false
          );
      }

      if (filter==="Son Gelenler") {
        list =
          [...list].reverse().slice(0,6);
      }

      if (search.trim()) {
        list =
          list.filter(
            p =>
              p.name
                .toLocaleLowerCase("tr")
                .includes(
                  search.toLocaleLowerCase("tr")
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
      (sum,item) =>
        sum + Number(item.qty || 0),
      0
    );

  const cartTotal =
    cart.reduce(
      (sum,item) =>
        sum +
        Number(item.price || 0) *
        Number(item.qty || 0),
      0
    );


  function openProduct(product) {

    setSelected(product);

    const firstColor =
      product.colors?.[0] || null;

    setSelectedColor(firstColor);

    setSelectedSize(null);

    setPage("product");

    window.scrollTo(0,0);
  }


  function goHome(category="Tümü") {

    setPage("home");
    setFilter(category);

    setTimeout(() => {

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
      alert("Renk seç.");
      return;
    }

    if (!selectedSize) {
      alert("Numara seç.");
      return;
    }

    const stock =
      Number(
        selectedColor
          .sizes?.[String(selectedSize)] || 0
      );

    if (stock <= 0) {
      alert("Bu numara tükendi.");
      return;
    }

    const key =
      `${selected.id}-${selectedColor.id}-${selectedSize}`;

    setCart(prev => {

      const found =
        prev.find(
          x => x.key===key
        );

      if (found) {

        if (found.qty >= stock) {
          alert("Stok sınırına ulaştın.");
          return prev;
        }

        return prev.map(
          x =>
            x.key===key
              ? {
                  ...x,
                  qty:x.qty+1
                }
              : x
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
            selectedColor.image ||
            selected.image,

          price:selected.price,

          qty:1
        }
      ];

    });

    setCartOpen(true);
  }


  function changeQty(key, delta) {

    setCart(prev =>
      prev
        .map(item => {

          if (item.key !== key) {
            return item;
          }

          const product = products.find(
            p => Number(p.id) === Number(item.productId)
          );

          const color = product?.colors?.find(
            c => c.id === item.colorId
          );

          const stock = Number(
            color?.sizes?.[String(item.size)] || 0
          );

          const nextQty = item.qty + delta;

          if (delta > 0 && nextQty > stock) {
            alert(`Bu varyanttan stokta yalnızca ${stock} adet var.`);
            return item;
          }

          return {
            ...item,
            qty: nextQty
          };

        })
        .filter(item => item.qty > 0)
    );
  }


  async function placeOrder(e) {

    e.preventDefault();

    const form =
      new FormData(e.currentTarget);

    const body = {
      customer:{
        name:form.get("name"),
        phone:form.get("phone"),
        email:form.get("email"),
        city:form.get("city"),
        district:form.get("district"),
        address:form.get("address")
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
          body:JSON.stringify(body)
        }
      );


    const data =
      await res.json();


    if (!res.ok) {
      alert(
        data.error ||
        "Sipariş oluşturulamadı."
      );
      return;
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
          onClick={()=>
            goHome()
          }
        >
          ☰
          <small>MENU</small>
        </button>


        <button
          className="brand"
          onClick={()=>
            goHome()
          }
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

          <section
            className="heroBanner heroTop"
          >

            <div className="heroPhoto">

              <img
                src="/products/yazlik-2.png"
              />

            </div>


            <div className="heroBlack">

              <h1>
                Özelleştirilmiş Koleksiyon
              </h1>

              <b>
                BY SHELİVA
              </b>

              <i></i>

              <span>
                YAZ 2026
              </span>

            </div>

          </section>


          <section
            className="heroBanner heroBottom"
          >

            <div className="heroBlack">

              <h1>
                Terra Koleksiyonu
              </h1>

              <b>
                BY SHELİVA
              </b>

              <i></i>

              <span>
                SUMMER COLLECTION
              </span>

            </div>


            <div className="heroPhoto">

              <img
                src="/products/yazlik-1.png"
              />

            </div>

          </section>


          <section className="categoryGrid">

            {[
              ["YAZLIK","Yazlık","/products/yazlik-2.png"],
              ["KIŞLIK","Kışlık","/products/kislik-2.png"],
              ["YENİ SEZON","Yeni Sezon","/products/yazlik-4.png"],
              ["İNDİRİMDE","Tümü","/products/kislik-4.png"],
              ["TÜM ÜRÜNLER","Tümü","/products/yazlik-1.png"],
              ["SON GELENLER","Son Gelenler","/products/kislik-3.png"]
            ].map(
              ([title,key,img]) => (

                <button
                  key={title}
                  onClick={()=>
                    goHome(key)
                  }
                >

                  <img src={img}/>

                  <strong>
                    {title}
                  </strong>

                  <span>
                    by SHELİVA
                  </span>

                </button>

              )
            )}

          </section>


          <section
            id="products"
            className="products"
          >

            <div className="productsTitle">

              <span>
                SHELİVA
              </span>

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

                        {product.image ? (
                          <img
                            src={
                              imageUrl(
                                product.image
                              )
                            }
                          />
                        ) : (
                          <div className="noImage">
                            SHELİVA
                          </div>
                        )}


                        <span className="saleTag">
                          %{product.discount ?? 15}
                        </span>

                      </div>


                      <div className="productCardText">

                        <small>
                          {product.category}
                        </small>

                        <h3>
                          {product.name}
                        </h3>

                        <strong>
                          {money(product.price)}
                        </strong>

                        <span className={
                          totalStock(product)>0
                            ? "stockAvailable"
                            : "stockOut"
                        }>
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
              onClick={()=>
                goHome()
              }
            >
              Ana Sayfa
            </button>

            <span>/</span>

            <b>
              {selected.name}
            </b>

          </div>


          <section className="detailTop">

            <div className="gallery">

              <div className="mainPhoto">

                {(
                  selectedColor?.image ||
                  selected.image
                ) ? (

                  <img
                    src={
                      imageUrl(
                        selectedColor?.image ||
                        selected.image
                      )
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

              <div className="detailPrice">

                <strong>
                  {money(selected.price)}
                </strong>

                <span>
                  %{selected.discount ?? 15}
                </span>

              </div>


              <div className="optionBlock">

                <label>
                  RENK
                </label>


                <div className="colorSelector">

                  {(selected.colors || []).map(
                    color => (

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
                        }}
                      >

                        {color.image && (

                          <img
                            src={
                              imageUrl(
                                color.image
                              )
                            }
                          />

                        )}

                        <span>
                          {color.name}
                        </span>

                      </button>

                    )
                  )}

                </div>

              </div>


              <div className="optionBlock">

                <label>
                  NUMARA
                </label>


                <div className="sizes">

                  {["36","37","38","39","40","41"].map(
                    size => {

                      const stock =
                        Number(
                          selectedColor
                            ?.sizes?.[size] || 0
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
                            {stock}
                          </small>

                        </button>

                      );
                    }
                  )}

                </div>

              </div>


              <button
                className="addButton"
                onClick={addToCart}
              >
                SEPETE EKLE
              </button>

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
                      imageUrl(
                        item.image
                      )
                    }
                  />


                  <div>

                    <h4>
                      {item.name}
                    </h4>

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

                  <span>
                    Toplam
                  </span>

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


                <textarea
                  name="address"
                  required
                  placeholder="Açık adres"
                />


                <div className="drawerTotal">

                  <span>
                    Toplam
                  </span>

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

                <b>
                  ✓
                </b>

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

