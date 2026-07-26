import { useEffect, useMemo, useState } from "react";
import "./App.css";

const API = "http://localhost:3001";

const SIZES = ["36","37","38","39","40","41"];

const money = n =>
  Number(n || 0).toLocaleString("tr-TR", {
    style: "currency",
    currency: "TRY"
  });

function emptyColor(index = 1) {
  return {
    id: `CLR-${Date.now()}-${index}`,
    name: "",
    image: "",
    imageData: "",
    sizes: {
      36:0,
      37:0,
      38:0,
      39:0,
      40:0,
      41:0
    }
  };
}

function emptyProduct() {
  return {
    name: "",
    category: "Yazlık",
    price: 0,
    discount: 15,
    description: "",
    active: true,
    newest: true,
    colors: [
      emptyColor(1)
    ]
  };
}

function totalStock(product) {
  return (product.colors || [])
    .reduce((sum,color) => {
      return sum +
        Object.values(color.sizes || {})
          .reduce(
            (s,v) => s + Number(v || 0),
            0
          );
    },0);
}

export default function App() {

  const [page,setPage] = useState("dashboard");

  const [products,setProducts] = useState([]);
  const [orders,setOrders] = useState([]);
  const [reviews,setReviews] = useState([]);

  const [connected,setConnected] = useState(false);

  const [orderTab,setOrderTab] = useState("Yeni");

  const [productModal,setProductModal] = useState(false);
  const [editing,setEditing] = useState(null);

  async function refresh() {
    try {
      const [p,o,r] = await Promise.all([
        fetch(`${API}/api/products`),
        fetch(`${API}/api/orders`),
        fetch(`${API}/api/reviews`)
      ]);

      if (!p.ok || !o.ok || !r.ok) {
        throw new Error();
      }

      setProducts(await p.json());
      setOrders(await o.json());
      setReviews(await r.json());

      setConnected(true);

    } catch {
      setConnected(false);
    }
  }

  useEffect(() => {
    refresh();

    const timer = setInterval(
      refresh,
      2500
    );

    return () =>
      clearInterval(timer);
  }, []);


  const modelCount =
    products.length;

  const stockCount =
    products.reduce(
      (sum,p) =>
        sum + totalStock(p),
      0
    );

  const activeOrders =
    orders.filter(
      o =>
        o.status !== "Teslim Edildi" &&
        o.status !== "İptal"
    );

  const newOrders =
    orders.filter(
      o => o.status === "Yeni"
    );

  const revenue =
    orders
      .filter(o => o.status !== "İptal")
      .reduce(
        (sum,o) =>
          sum + Number(o.total || 0),
        0
      );

  const completedSales =
    orders
      .filter(
        o => o.status === "Teslim Edildi"
      )
      .reduce(
        (sum,o) =>
          sum + Number(o.total || 0),
        0
      );

  const urgentOrders =
    orders.filter(o => {
      if (
        o.status === "Teslim Edildi" ||
        o.status === "Kargoya Verildi" ||
        o.status === "İptal"
      ) {
        return false;
      }

      const age =
        Date.now() -
        new Date(o.createdAt).getTime();

      return age >=
        3 * 24 * 60 * 60 * 1000;
    });


  const filteredOrders =
    useMemo(
      () =>
        orders.filter(
          o => o.status === orderTab
        ),
      [orders,orderTab]
    );


  function openNewProduct() {
    setEditing(emptyProduct());
    setProductModal(true);
  }

  function openEditProduct(product) {
    setEditing(
      JSON.parse(
        JSON.stringify(product)
      )
    );

    setProductModal(true);
  }


  async function saveProduct(e) {

    e.preventDefault();

    if (!editing.name.trim()) {
      alert("Ürün adı gerekli.");
      return;
    }

    if (!editing.colors?.length) {
      alert("En az 1 renk gerekli.");
      return;
    }

    for (const color of editing.colors) {
      if (!color.name.trim()) {
        alert("Renk adı boş olamaz.");
        return;
      }
    }

    const editingId =
      Number(editing.id);

    const isExisting =
      Number.isFinite(editingId) &&
      products.some(
        p => Number(p.id) === editingId
      );

    const method =
      isExisting
        ? "PUT"
        : "POST";

    const url =
      isExisting
        ? `${API}/api/products/${editingId}`
        : `${API}/api/products`;

    const res = await fetch(url,{
      method,
      headers:{
        "Content-Type":"application/json"
      },
      body:JSON.stringify(editing)
    });

    const data =
      await res.json();

    if (!res.ok) {
      alert(
        data.error ||
        "Ürün kaydedilemedi."
      );
      return;
    }

    setProductModal(false);
    setEditing(null);

    await refresh();
  }


  async function deleteProduct(product) {
    if (
      !confirm(
        `${product.name} silinsin mi?`
      )
    ) {
      return;
    }

    await fetch(
      `${API}/api/products/${product.id}`,
      {
        method:"DELETE"
      }
    );

    await refresh();
  }


  async function changeOrderStatus(
    order,
    status
  ) {

    const res = await fetch(
      `${API}/api/orders/${order.id}/status`,
      {
        method:"PUT",
        headers:{
          "Content-Type":"application/json"
        },
        body:JSON.stringify({
          status
        })
      }
    );

    if (!res.ok) {
      alert("Sipariş güncellenemedi.");
      return;
    }

    await refresh();
  }


  return (
    <div className="app">

      <aside className="sidebar">

        <div className="logo">
          SHELİVA
          <small>
            YÖNETİM PANELİ
          </small>
        </div>


        <nav>

          <Menu
            active={page==="dashboard"}
            label="Genel Bakış"
            icon="⌂"
            onClick={()=>setPage("dashboard")}
          />

          <Menu
            active={page==="orders"}
            label="Siparişler"
            icon="▣"
            badge={newOrders.length}
            onClick={()=>setPage("orders")}
          />

          <Menu
            active={page==="products"}
            label="Ürünler"
            icon="◇"
            onClick={()=>setPage("products")}
          />

          <Menu
            active={page==="stock"}
            label="Stok"
            icon="▤"
            onClick={()=>setPage("stock")}
          />

          <Menu
            active={page==="shipping"}
            label="Kargolar"
            icon="▰"
            onClick={()=>setPage("shipping")}
          />

          <Menu
            active={page==="customers"}
            label="Müşteriler"
            icon="♙"
            onClick={()=>setPage("customers")}
          />

          <Menu
            active={page==="reviews"}
            label="Yorumlar"
            icon="★"
            badge={
              reviews.filter(
                r => !r.approved
              ).length
            }
            onClick={()=>setPage("reviews")}
          />

          <Menu
            active={page==="returns"}
            label="İadeler"
            icon="↩"
            onClick={()=>setPage("returns")}
          />

          <Menu
            active={page==="reports"}
            label="Raporlar"
            icon="⌁"
            onClick={()=>setPage("reports")}
          />

          <Menu
            active={page==="settings"}
            label="Ayarlar"
            icon="⚙"
            onClick={()=>setPage("settings")}
          />

        </nav>

      </aside>


      <main>

        <header className="topbar">

          <div>
            <small>SHELİVA</small>

            <h1>
              {page==="dashboard" && "Genel Bakış"}
              {page==="orders" && "Siparişler"}
              {page==="products" && "Ürünler"}
              {page==="stock" && "Stok Yönetimi"}
              {page==="shipping" && "Kargolar"}
              {page==="customers" && "Müşteriler"}
              {page==="reviews" && "Yorumlar"}
              {page==="returns" && "İadeler"}
              {page==="reports" && "Raporlar"}
              {page==="settings" && "Ayarlar"}
            </h1>
          </div>


          <div
            className={
              connected
                ? "server connected"
                : "server"
            }
          >
            <i></i>

            {connected
              ? "SERVER BAĞLI"
              : "SERVER BAĞLANTISI YOK"}
          </div>

        </header>


        {page==="dashboard" && (

          <>
            <section className="stats">

              <Stat
                label="Toplam Model Sayısı"
                value={modelCount}
                icon="◇"
              />

              <Stat
                label="Toplam Ürün Adeti"
                value={stockCount}
                icon="▣"
              />

              <Stat
                label="Toplam Aktif Siparişler"
                value={activeOrders.length}
                icon="▤"
              />

            </section>


            <section className="finance">

              <div className="financeCard revenue">

                <span>
                  Toplam Ciro
                </span>

                <strong>
                  {money(revenue)}
                </strong>

              </div>


              <div className="financeCard sales">

                <span>
                  Toplam Satış
                </span>

                <strong>
                  {money(completedSales)}
                </strong>

              </div>

            </section>


            <section className="dashboardBottom">

              <div className="newOrdersCard">

                <div className="cardTitle">

                  <div>
                    <h2>
                      Yeni Siparişler
                    </h2>

                    <p>
                      Onay bekleyen siparişler
                    </p>
                  </div>


                  <button
                    onClick={()=>{
                      setOrderTab("Yeni");
                      setPage("orders");
                    }}
                  >
                    Tümünü Gör →
                  </button>

                </div>


                {!newOrders.length ? (

                  <div className="noOrders">
                    Yeni sipariş yok.
                  </div>

                ) : (

                  newOrders.slice(0,5).map(
                    order => (

                      <div
                        className="dashboardOrder"
                        key={order.id}
                      >

                        <b>
                          {order.orderNo}
                        </b>

                        <span>
                          {order.customer.name}
                        </span>

                        <span>
                          {order.items?.[0]?.name}
                        </span>

                        <strong>
                          {money(order.total)}
                        </strong>

                      </div>

                    )
                  )

                )}

              </div>


              <div className="urgentCard">

                <div className="urgentTitle">

                  <div>
                    <h2>
                      ⚠ Acil Kargoya Verilecekler
                    </h2>

                    <p>
                      3 günü geçenler
                    </p>
                  </div>

                  <b>
                    {urgentOrders.length}
                  </b>

                </div>


                {!urgentOrders.length ? (

                  <div className="urgentEmpty">
                    Acil sipariş yok.
                  </div>

                ) : (

                  urgentOrders.map(order => (

                    <div
                      className="urgentItem"
                      key={order.id}
                    >

                      <div>
                        <b>
                          {order.orderNo}
                        </b>

                        <span>
                          {order.customer.name}
                        </span>
                      </div>

                      <strong>
                        ACİL
                      </strong>

                    </div>

                  ))

                )}

              </div>

            </section>
          </>

        )}


        {page==="orders" && (

          <section className="pageCard">

            <div className="orderTabs">

              {[
                "Yeni",
                "Hazırlanıyor",
                "Kargoya Verildi",
                "Teslim Edildi"
              ].map(status => (

                <button
                  key={status}
                  className={
                    orderTab===status
                      ? "active"
                      : ""
                  }
                  onClick={()=>
                    setOrderTab(status)
                  }
                >

                  {status}

                  <b>
                    {
                      orders.filter(
                        o => o.status===status
                      ).length
                    }
                  </b>

                </button>

              ))}

            </div>


            {!filteredOrders.length ? (

              <div className="emptyPage">
                Bu durumda sipariş yok.
              </div>

            ) : (

              <div className="orderCards">

                {filteredOrders.map(
                  order => (

                    <article
                      className="orderCard"
                      key={order.id}
                    >

                      <div className="orderTop">

                        <div>
                          <small>
                            SİPARİŞ
                          </small>

                          <h3>
                            {order.orderNo}
                          </h3>
                        </div>

                        <em>
                          {order.status}
                        </em>

                      </div>


                      <div className="orderInfo">

                        <label>
                          Müşteri
                          <b>
                            {order.customer.name}
                          </b>
                        </label>

                        <label>
                          Telefon
                          <b>
                            {order.customer.phone}
                          </b>
                        </label>

                      </div>


                      <div className="orderedProducts">

                        {(order.items || []).map(
                          item => (

                            <div key={item.key}>

                              <span>
                                {item.name}
                              </span>

                              <small>
                                {item.colorName}
                                {" • "}
                                {item.size}
                                {" • "}
                                {item.qty} adet
                              </small>

                            </div>

                          )
                        )}

                      </div>


                      <div className="orderBottom">

                        <strong>
                          {money(order.total)}
                        </strong>


                        {order.status==="Yeni" && (
                          <button
                            onClick={()=>
                              changeOrderStatus(
                                order,
                                "Hazırlanıyor"
                              )
                            }
                          >
                            HAZIRLAMAYA AL
                          </button>
                        )}


                        {order.status==="Hazırlanıyor" && (
                          <button
                            onClick={()=>
                              changeOrderStatus(
                                order,
                                "Kargoya Verildi"
                              )
                            }
                          >
                            KARGOYA VER
                          </button>
                        )}


                        {order.status==="Kargoya Verildi" && (
                          <button
                            onClick={()=>
                              changeOrderStatus(
                                order,
                                "Teslim Edildi"
                              )
                            }
                          >
                            TESLİM EDİLDİ
                          </button>
                        )}

                      </div>

                    </article>

                  )
                )}

              </div>

            )}

          </section>

        )}


        {page==="products" && (

          <section className="pageCard">

            <div className="pageTitle">

              <div>
                <h2>
                  Ürünler
                </h2>

                <p>
                  Panelden eklenen ürünler
                  otomatik mağazada görünür.
                </p>
              </div>


              <button onClick={openNewProduct}>
                + YENİ ÜRÜN
              </button>

            </div>


            {!products.length ? (

              <div className="emptyPage">
                Henüz ürün yok.
                <br/>
                Yeni Ürün ile ilk modeli ekle.
              </div>

            ) : (

              <div className="productManagerGrid">

                {products.map(product => (

                  <article
                    className="managerProduct"
                    key={product.id}
                  >

                    <div className="managerImage">

                      {product.image ? (
                        <img
                          src={
                            product.image.startsWith("/uploads/")
                              ? API + product.image
                              : product.image
                          }
                        />
                      ) : (
                        <span>
                          FOTOĞRAF YOK
                        </span>
                      )}

                    </div>


                    <div className="managerInfo">

                      <small>
                        {product.code}
                      </small>

                      <h3>
                        {product.name}
                      </h3>

                      <p>
                        {product.category}
                        {" • "}
                        {totalStock(product)} stok
                      </p>

                      <strong>
                        {money(product.price)}
                      </strong>


                      <div className="managerActions">

                        <button
                          onClick={()=>
                            openEditProduct(product)
                          }
                        >
                          DÜZENLE
                        </button>

                        <button
                          className="danger"
                          onClick={()=>
                            deleteProduct(product)
                          }
                        >
                          SİL
                        </button>

                      </div>

                    </div>

                  </article>

                ))}

              </div>

            )}

          </section>

        )}


        {page==="stock" && (

          <section className="pageCard">

            <div className="pageTitle">

              <div>
                <h2>
                  Stok Yönetimi
                </h2>

                <p>
                  Renk ve numara bazında stok.
                </p>
              </div>

            </div>


            {products.map(product => (

              <div
                className="stockProductCard"
                key={product.id}
              >

                <div className="stockProductTitle">

                  <div>
                    <h3>
                      {product.name}
                    </h3>

                    <span>
                      {product.code}
                    </span>
                  </div>

                  <strong>
                    {totalStock(product)} adet
                  </strong>

                </div>


                {(product.colors || []).map(
                  color => (

                    <div
                      className="stockColor"
                      key={color.id}
                    >

                      <b>
                        {color.name}
                      </b>


                      <div className="stockSizes">

                        {SIZES.map(size => (

                          <div
                            className="stockSize"
                            key={size}
                          >

                            <span>
                              {size}
                            </span>

                            <strong>
                              {
                                Number(
                                  color.sizes?.[size] || 0
                                )
                              }
                            </strong>

                          </div>

                        ))}

                      </div>

                    </div>

                  )
                )}

                <button
                  className="editStock"
                  onClick={()=>
                    openEditProduct(product)
                  }
                >
                  STOK DÜZENLE
                </button>

              </div>

            ))}

          </section>

        )}


        {[
          "shipping",
          "customers",
          "reviews",
          "returns",
          "reports",
          "settings"
        ].includes(page) && (

          <section className="pageCard">

            <div className="emptyPage">
              Bu bölüm sonraki aşamada
              geliştirilecek.
            </div>

          </section>

        )}

      </main>


      {productModal && editing && (

        <ProductModal
          product={editing}
          setProduct={setEditing}
          save={saveProduct}
          close={()=>{
            setProductModal(false);
            setEditing(null);
          }}
        />

      )}

    </div>
  );
}


function Menu({
  active,
  label,
  icon,
  badge,
  onClick
}) {

  return (
    <button
      className={active ? "active" : ""}
      onClick={onClick}
    >

      <span>
        {icon}
      </span>

      <span>
        {label}
      </span>

      {!!badge && (
        <b className="navBadge">
          {badge}
        </b>
      )}

    </button>
  );
}


function Stat({
  label,
  value,
  icon
}) {

  return (
    <div className="statCard">

      <div className="statIcon">
        {icon}
      </div>

      <div>
        <span>
          {label}
        </span>

        <strong>
          {value}
        </strong>
      </div>

    </div>
  );
}


function ProductModal({
  product,
  setProduct,
  save,
  close
}) {

  function addColor() {
    setProduct({
      ...product,
      colors:[
        ...(product.colors || []),
        emptyColor(
          (product.colors?.length || 0) + 1
        )
      ]
    });
  }


  function updateColor(index, patch) {

    const colors =
      [...product.colors];

    colors[index] = {
      ...colors[index],
      ...patch
    };

    setProduct({
      ...product,
      colors
    });
  }


  function removeColor(index) {

    const colors =
      product.colors.filter(
        (_,i) => i!==index
      );

    setProduct({
      ...product,
      colors
    });
  }


  function chooseImage(
    e,
    index
  ) {

    const file =
      e.target.files?.[0];

    if (!file) return;

    const reader =
      new FileReader();

    reader.onload = () => {

      updateColor(
        index,
        {
          imageData:reader.result
        }
      );

    };

    reader.readAsDataURL(file);
  }


  return (
    <div className="modalShade">

      <form
        className="productModal"
        onSubmit={save}
      >

        <div className="modalHeader">

          <div>
            <small>
              SHELİVA
            </small>

            <h2>
              {product.id
                ? "Ürün Düzenle"
                : "Yeni Ürün"}
            </h2>
          </div>

          <button
            type="button"
            onClick={close}
          >
            ×
          </button>

        </div>


        <div className="modalBody">

          <label>
            Ürün Adı

            <input
              value={product.name}
              onChange={e=>
                setProduct({
                  ...product,
                  name:e.target.value
                })
              }
            />
          </label>


          <div className="two">

            <label>
              Kategori

              <select
                value={product.category}
                onChange={e=>
                  setProduct({
                    ...product,
                    category:e.target.value
                  })
                }
              >
                <option>
                  Yazlık
                </option>

                <option>
                  Kışlık
                </option>
              </select>
            </label>


            <label>
              Satış Fiyatı

              <input
                type="number"
                value={product.price}
                onChange={e=>
                  setProduct({
                    ...product,
                    price:
                      Number(e.target.value)
                  })
                }
              />
            </label>

          </div>


          <label>
            İndirim %

            <input
              type="number"
              value={product.discount}
              onChange={e=>
                setProduct({
                  ...product,
                  discount:
                    Number(e.target.value)
                })
              }
            />
          </label>


          <label>
            Açıklama

            <textarea
              value={
                product.description || ""
              }
              onChange={e=>
                setProduct({
                  ...product,
                  description:
                    e.target.value
                })
              }
            />
          </label>


          <div className="variantsTitle">

            <div>
              <h3>
                Renkler & Numaralar
              </h3>

              <p>
                Her renk için ayrı stok gir.
              </p>
            </div>

            <button
              type="button"
              onClick={addColor}
            >
              + RENK EKLE
            </button>

          </div>


          {(product.colors || []).map(
            (color,index) => (

              <div
                className="colorEditor"
                key={color.id}
              >

                <div className="colorHead">

                  <input
                    placeholder="Renk adı"
                    value={color.name}
                    onChange={e=>
                      updateColor(
                        index,
                        {
                          name:e.target.value
                        }
                      )
                    }
                  />

                  <label className="imageButton">

                    FOTOĞRAF SEÇ

                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={e=>
                        chooseImage(e,index)
                      }
                    />

                  </label>


                  {product.colors.length>1 && (
                    <button
                      type="button"
                      className="removeColor"
                      onClick={()=>
                        removeColor(index)
                      }
                    >
                      RENGİ SİL
                    </button>
                  )}

                </div>


                <div className="variantStocks">

                  {SIZES.map(size => (

                    <label key={size}>

                      {size}

                      <input
                        type="number"
                        min="0"
                        value={
                          color.sizes?.[size] || 0
                        }
                        onChange={e=>
                          updateColor(
                            index,
                            {
                              sizes:{
                                ...color.sizes,
                                [size]:
                                  Math.max(
                                    0,
                                    Number(
                                      e.target.value
                                    )
                                  )
                              }
                            }
                          )
                        }
                      />

                    </label>

                  ))}

                </div>

              </div>

            )
          )}

        </div>


        <div className="modalFooter">

          <button
            type="button"
            onClick={close}
          >
            İPTAL
          </button>

          <button
            className="saveProduct"
          >
            KAYDET
          </button>

        </div>

      </form>

    </div>
  );
}
